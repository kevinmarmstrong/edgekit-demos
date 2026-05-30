import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { createAdminWorkflowServer } from '../demos/admin-workflow/src/admin-workflow-demo.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const today = new Date().toISOString().slice(0, 10)
const artifactDir = path.join(repoRoot, 'qa-artifacts', today, 'admin-workflow')
const flags = ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--enable-features=PromptAPI,AILanguageModel,AITextSession']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitFor(predicate, { timeoutMs = 10_000, intervalMs = 100, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await predicate()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`)
}

function launchChrome(url, userDataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(chromePath, [...flags, `--user-data-dir=${userDataDir}`, url], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    let stdout = ''
    const failTimer = setTimeout(() => reject(new Error(`Chrome did not expose DevTools endpoint. stdout=${stdout} stderr=${stderr}`)), 15_000)
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) {
        clearTimeout(failTimer)
        resolve({ child, browserWsUrl: match[1] })
      }
    })
    child.once('error', (error) => { clearTimeout(failTimer); reject(error) })
    child.once('exit', (code, signal) => {
      if (!stderr.includes('DevTools listening on')) {
        clearTimeout(failTimer)
        reject(new Error(`Chrome exited before DevTools endpoint was ready: code=${code} signal=${signal}`))
      }
    })
  })
}

class CdpSession {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.nextId = 1
    this.pending = new Map()
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(JSON.stringify(message.error)))
        else resolve(message.result)
      }
    })
  }
  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return
    await once(this.ws, 'open')
  }
  send(method, params = {}) {
    const id = this.nextId++
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
    this.ws.send(JSON.stringify({ id, method, params }))
    return promise
  }
  close() { this.ws.close() }
}

async function getPageWebSocket(baseDevtoolsUrl, expectedUrl) {
  return waitFor(async () => {
    const response = await fetch(`${baseDevtoolsUrl}/json/list`)
    const pages = await response.json()
    return pages.find((page) => page.type === 'page' && page.url?.startsWith(expectedUrl))?.webSocketDebuggerUrl
  }, { label: 'Chrome page target' })
}

async function evaluate(session, expression) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await session.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails, null, 2))
      return result.result.value
    } catch (error) {
      if (!/Execution context was destroyed|Cannot find context/.test(error.message) || attempt === 5) throw error
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
    }
  }
}

async function main() {
  await fs.mkdir(artifactDir, { recursive: true })
  const server = createAdminWorkflowServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edgekit-admin-workflow-qa-'))
  let chrome
  let session
  try {
    chrome = await launchChrome(`${baseUrl}/`, userDataDir)
    const devtoolsBaseUrl = chrome.browserWsUrl.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.+$/, '')
    session = new CdpSession(await getPageWebSocket(devtoolsBaseUrl, baseUrl))
    await session.ready()
    await session.send('Page.enable')
    await session.send('Runtime.enable')
    await waitFor(() => evaluate(session, 'document.readyState === "complete"'), { label: 'document complete' })

    const providerEvidence = await evaluate(session, `(() => ({
      userAgent: navigator.userAgent,
      hasWindowAI: 'ai' in window,
      aiKeys: window.ai ? Object.keys(window.ai) : [],
      hasWindowAiLanguageModel: !!(window.ai && (window.ai.languageModel || window.ai.LanguageModel)),
      hasGlobalLanguageModel: 'LanguageModel' in window,
      chromeFlags: ${JSON.stringify(flags)},
    }))()`)

    const flowEvidence = await evaluate(session, `(async () => {
      const wait = (predicate, timeoutMs = 10000) => new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs
        const tick = () => {
          try { if (predicate()) return resolve(true) } catch {}
          if (Date.now() > deadline) return reject(new Error('wait timed out'))
          setTimeout(tick, 50)
        }
        tick()
      })
      await wait(() => document.querySelector('#local-output')?.textContent.includes('deterministic-local-browser-model'))
      document.querySelector('#run-search').click()
      await wait(() => document.querySelector('#telemetry-output')?.textContent.includes('local_tool.outcome'))
      const searchRun = JSON.parse(document.querySelector('#local-output').textContent)
      document.querySelector('#run-evaluate').click()
      await wait(() => document.querySelector('#telemetry-output')?.textContent.includes('policy.evaluated'))
      const proposalRun = JSON.parse(document.querySelector('#local-output').textContent)
      document.querySelector('#run-approval').click()
      await wait(() => document.querySelector('#approval-output')?.textContent.includes('approved'))
      const approvalRun = JSON.parse(document.querySelector('#local-output').textContent)
      document.querySelector('#run-mutation').click()
      await wait(() => document.querySelector('#server-output')?.textContent.includes('server_route.completed'))
      const mutationRun = JSON.parse(document.querySelector('#local-output').textContent)
      const serverResult = JSON.parse(document.querySelector('#server-output').textContent)
      const fullText = document.body.innerText
      return {
        title: document.title,
        localModeCopy: document.querySelector('#local-mode-copy').textContent,
        serverModeCopy: document.querySelector('#server-mode-copy').textContent,
        searchRun,
        proposalRun,
        approvalRun,
        mutationRun,
        serverResult,
        secretLeakChecks: {
          ownerEmailVisible: /northstar-owner@example.com|riverbend-owner@example.com/.test(fullText),
          secretNoteVisible: /secret_/.test(fullText),
          serverHasSecretLeak: /ownerEmail|internalRiskNotes|secret_/.test(JSON.stringify(serverResult)),
        },
      }
    })()`)

    assert(providerEvidence.hasWindowAiLanguageModel === false, 'Chrome AI Prompt/LanguageModel unexpectedly available; update lane classification')
    assert(flowEvidence.searchRun.provider === 'deterministic-local-browser-model', 'deterministic local/browser model did not run')
    assert(flowEvidence.searchRun.toolCalls?.[0]?.name === 'searchAccounts', 'searchAccounts was not called first')
    assert(flowEvidence.proposalRun.toolCalls?.[0]?.name === 'evaluateAdminChange', 'evaluateAdminChange was not called')
    assert(flowEvidence.approvalRun.toolCalls?.[0]?.name === 'requestAdminApproval', 'requestAdminApproval was not called')
    assert(flowEvidence.mutationRun.toolCalls?.[0]?.name === 'executeApprovedAdminChange', 'executeApprovedAdminChange was not called')
    assert(flowEvidence.serverResult.mutation?.accountAfter?.plan === 'Enterprise', 'approved mutation did not update host-owned account state')
    assert(flowEvidence.serverResult.telemetry?.some((event) => event.type === 'server_route.completed'), 'server route telemetry missing')
    assert(flowEvidence.serverResult.auditEntries?.length === 3, 'audit trail missing approval/mutation entries')
    assert(flowEvidence.secretLeakChecks.ownerEmailVisible === false, 'hidden owner email leaked into browser output')
    assert(flowEvidence.secretLeakChecks.secretNoteVisible === false, 'hidden secret note leaked into browser output')
    assert(flowEvidence.secretLeakChecks.serverHasSecretLeak === false, 'server result leaked hidden account fields')

    const screenshot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    const screenshotPath = path.join(artifactDir, 'admin-workflow-browser-qa.png')
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
    const evidence = { generatedAt: new Date().toISOString(), chromePath, chromeFlags: flags, baseUrl, providerDecision: 'deterministic-model-backed-acceptance-harness', providerEvidence, flowEvidence, screenshotPath: path.relative(repoRoot, screenshotPath) }
    const evidenceJsonPath = path.join(artifactDir, 'evidence.json')
    await fs.writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`)
    const eventTypes = flowEvidence.serverResult.telemetry.map((event) => event.type).join(', ')
    const report = `Audience: demo-team\n\n# Admin workflow browser QA evidence\n\nGenerated: ${evidence.generatedAt}\n\n## Provider decision\n\nChosen lane: deterministic model-backed local/browser acceptance harness. Chrome AI/LanguageModel was probed and unavailable in this headless browser, so Basic/search-only fallback was not counted.\n\n- userAgent: ${providerEvidence.userAgent}\n- window.ai present: ${providerEvidence.hasWindowAI}\n- window.ai language model present: ${providerEvidence.hasWindowAiLanguageModel}\n- global LanguageModel present: ${providerEvidence.hasGlobalLanguageModel}\n\n## Browser proof\n\nThe harness opened the local enterprise admin demo in real headless Chrome and exercised:\n\n1. Local/browser model selected and called \`searchAccounts\`.\n2. It called \`evaluateAdminChange\` and surfaced RBAC/policy risk.\n3. It called \`requestAdminApproval\` before mutation.\n4. It posted completed local proof, explicit \`x-edgekit-app-authority\`, and approved approval record to the app-owned mutation route.\n5. The app-owned route executed \`executeApprovedAdminChange\`, updated host-owned account state, and returned telemetry/audit.\n6. Hidden account owner emails and internal risk notes did not render.\n\nEvidence:\n\n- local model provider: ${flowEvidence.searchRun.provider}\n- local model capability: ${flowEvidence.searchRun.capability}\n- tool call order: ${[flowEvidence.searchRun, flowEvidence.proposalRun, flowEvidence.approvalRun, flowEvidence.mutationRun].map((run) => run.toolCalls[0].name).join(' -> ')}\n- mutation plan after approval: ${flowEvidence.serverResult.mutation.accountAfter.plan}\n- telemetry events: ${eventTypes}\n- audit entries: ${flowEvidence.serverResult.auditEntries.length}\n- secret leak checks: ${JSON.stringify(flowEvidence.secretLeakChecks)}\n- screenshot: ${path.relative(repoRoot, screenshotPath)}\n- raw evidence: ${path.relative(repoRoot, evidenceJsonPath)}\n\n## Product outcome\n\n\`admin-workflow\` now has a repeatable local/browser demo lane proving account search, RBAC/policy evaluation, approval-gated risky mutation, host-owned execution, telemetry, and audit in a real browser. It remains browser-qa-pass rather than golden-pass until review/merge and retest from a clean integrated branch.\n`
    const reportPath = path.join(artifactDir, 'report.md')
    await fs.writeFile(reportPath, report)
    console.log(JSON.stringify({ ok: true, reportPath: path.relative(repoRoot, reportPath), evidenceJsonPath: path.relative(repoRoot, evidenceJsonPath), screenshotPath: path.relative(repoRoot, screenshotPath), providerDecision: evidence.providerDecision }, null, 2))
  } finally {
    if (session) session.close()
    if (chrome?.child && !chrome.child.killed) chrome.child.kill('SIGTERM')
    await new Promise((resolve) => server.close(() => resolve()))
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
