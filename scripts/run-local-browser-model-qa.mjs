import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { createWorkerHandoffServer } from '../demos/worker-handoff/src/worker-handoff-demo.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const today = new Date().toISOString().slice(0, 10)
const artifactDir = path.join(repoRoot, 'qa-artifacts', today, 'local-browser-model-lane')
const flags = [
  '--headless=new',
  '--remote-debugging-port=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--enable-features=PromptAPI,AILanguageModel,AITextSession',
]

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
    const child = spawn(chromePath, [...flags, `--user-data-dir=${userDataDir}`, url], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    let stdout = ''
    const failTimer = setTimeout(() => {
      reject(new Error(`Chrome did not expose DevTools endpoint. stdout=${stdout} stderr=${stderr}`))
    }, 15_000)
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) {
        clearTimeout(failTimer)
        resolve({ child, browserWsUrl: match[1], stdout: () => stdout, stderr: () => stderr })
      }
    })
    child.once('error', (error) => {
      clearTimeout(failTimer)
      reject(error)
    })
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
    const payload = { id, method, params }
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
    this.ws.send(JSON.stringify(payload))
    return promise
  }

  close() {
    this.ws.close()
  }
}

async function getPageWebSocket(baseDevtoolsUrl, expectedUrl) {
  const targets = await waitFor(async () => {
    const response = await fetch(`${baseDevtoolsUrl}/json/list`)
    const pages = await response.json()
    return pages.find((page) => page.type === 'page' && page.url?.startsWith(expectedUrl))?.webSocketDebuggerUrl
  }, { label: 'Chrome page target' })
  return targets
}

async function evaluate(session, expression) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await session.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
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
  const server = createWorkerHandoffServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edgekit-local-browser-qa-'))
  let chrome
  let session
  try {
    chrome = await launchChrome(`${baseUrl}/`, userDataDir)
    const devtoolsBaseUrl = chrome.browserWsUrl.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.+$/, '')
    const pageWsUrl = await getPageWebSocket(devtoolsBaseUrl, baseUrl)
    session = new CdpSession(pageWsUrl)
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
      hasWebLLM: 'webllm' in window,
      chromeFlags: ${JSON.stringify(flags)},
    }))()`)

    const flowEvidence = await evaluate(session, `(async () => {
      const wait = (predicate, timeoutMs = 10000) => new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs
        const tick = () => {
          try {
            if (predicate()) return resolve(true)
          } catch {}
          if (Date.now() > deadline) return reject(new Error('wait timed out'))
          setTimeout(tick, 50)
        }
        tick()
      })
      await wait(() => document.querySelector('#local-output')?.textContent.includes('cascadeSteps'))
      document.querySelector('#run-local').click()
      await wait(() => document.querySelector('#local-output')?.textContent.includes('deterministic-local-browser-model'))
      const localModelRun = JSON.parse(document.querySelector('#local-output').textContent)
      document.querySelector('#run-handoff').click()
      await wait(() => document.querySelector('#server-output')?.textContent.includes('server_route.completed'))
      const handoffModelRun = JSON.parse(document.querySelector('#local-output').textContent)
      const handoffReview = JSON.parse(document.querySelector('#handoff-output').textContent)
      const serverResult = JSON.parse(document.querySelector('#server-output').textContent)
      const fullText = document.body.innerText
      return {
        title: document.title,
        localModeCopy: document.querySelector('#local-mode-copy').textContent,
        serverModeCopy: document.querySelector('#server-mode-copy').textContent,
        localModelRun,
        handoffModelRun,
        handoffReview,
        serverResult,
        secretLeakChecks: {
          aliceEmailVisible: fullText.includes('alice@example.com'),
          secretTokenVisible: fullText.includes('secret_customer_token'),
          appAuthTokenVisible: fullText.includes('secret_token_should_not_cross_boundary'),
          handoffReviewHasSecretLeak: handoffReview.hasSecretLeak,
        },
      }
    })()`)

    assert(providerEvidence.hasWindowAiLanguageModel === false, 'Chrome AI Prompt/LanguageModel unexpectedly available; update lane classification')
    assert(flowEvidence.localModelRun.provider === 'deterministic-local-browser-model', 'deterministic model provider did not run')
    assert(flowEvidence.localModelRun.toolCalls?.[0]?.name === 'summarizeVisibleDashboard', 'local model did not call summarizeVisibleDashboard')
    assert(flowEvidence.serverResult.policy?.outcome === 'allowed', 'app-owned worker policy did not allow expected tool')
    assert(flowEvidence.serverResult.auditEntries?.length === 2, 'audit trail did not record expected entries')
    assert(flowEvidence.serverResult.telemetry?.some((event) => event.type === 'mode.transition'), 'mode transition telemetry missing')
    assert(flowEvidence.secretLeakChecks.aliceEmailVisible === false, 'prompt email leaked into visible output')
    assert(flowEvidence.secretLeakChecks.secretTokenVisible === false, 'prompt secret token leaked into visible output')
    assert(flowEvidence.secretLeakChecks.appAuthTokenVisible === false, 'app auth token leaked into visible output')
    assert(flowEvidence.secretLeakChecks.handoffReviewHasSecretLeak === false, 'handoff review reported secret leak')

    const screenshot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    const screenshotPath = path.join(artifactDir, 'worker-handoff-deterministic-model.png')
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))

    const evidence = {
      generatedAt: new Date().toISOString(),
      chromePath,
      chromeFlags: flags,
      baseUrl,
      providerDecision: providerEvidence.hasWindowAiLanguageModel
        ? 'real-chrome-ai-available'
        : 'deterministic-model-backed-acceptance-harness',
      providerEvidence,
      flowEvidence,
      screenshotPath: path.relative(repoRoot, screenshotPath),
    }
    const evidenceJsonPath = path.join(artifactDir, 'evidence.json')
    await fs.writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`)

    const eventTypes = flowEvidence.serverResult.telemetry.map((event) => event.type).join(', ')
    const report = `Audience: demo-team

# Local/browser model QA lane evidence

Generated: ${evidence.generatedAt}

## Provider decision

Chosen lane: deterministic model-backed acceptance harness.

Real Chrome AI was probed in ${chromePath} with flags ${flags.map((flag) => `\`${flag}\``).join(', ')}. The page reported:

- userAgent: ${providerEvidence.userAgent}
- window.ai present: ${providerEvidence.hasWindowAI}
- window.ai language model present: ${providerEvidence.hasWindowAiLanguageModel}
- global LanguageModel present: ${providerEvidence.hasGlobalLanguageModel}
- WebLLM object present before app install: ${providerEvidence.hasWebLLM}

Because this Mac/browser session still does not expose Chrome AI Prompt/LanguageModel APIs and no WebLLM test profile is installed in this repo, the verifiable lane is the deterministic browser-local model harness embedded in the worker-handoff browser proof. Basic/search-only fallback is not counted.

## Setup commands

\`\`\`bash
PATH=/opt/homebrew/bin:$PATH npm install --include=dev
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH node scripts/run-local-browser-model-qa.mjs
\`\`\`

Optional Chrome override:

\`\`\`bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/run-local-browser-model-qa.mjs
\`\`\`

## Worker-handoff browser proof

The harness opened the local worker-handoff demo in real headless Chrome and exercised the page controls:

1. Deterministic local/browser model selected \`summarizeVisibleDashboard\`.
2. The local browser tool read visible host-app state before server handoff.
3. The model classified the warehouse report as requiring app-owned Worker mode.
4. The browser posted completed local proof plus explicit \`x-edgekit-app-authority\`.
5. The app-owned Worker route executed \`generateBillingVarianceReport\` through policy.
6. The output included telemetry/audit without leaking prompt PII or app secrets.

Evidence:

- local model provider: ${flowEvidence.localModelRun.provider}
- local model capability: ${flowEvidence.localModelRun.capability}
- local tool call: ${flowEvidence.localModelRun.toolCalls[0].name}
- mode copy: ${flowEvidence.serverModeCopy}
- policy outcome: ${flowEvidence.serverResult.policy.outcome}
- telemetry events: ${eventTypes}
- audit entries: ${flowEvidence.serverResult.auditEntries.length}
- secret leak checks: ${JSON.stringify(flowEvidence.secretLeakChecks)}
- screenshot: ${path.relative(repoRoot, screenshotPath)}
- raw evidence: ${path.relative(repoRoot, evidenceJsonPath)}

## Product outcome

\`worker-handoff\` now has a repeatable local/browser model QA lane that proves tool use, bounded handoff, app-owned server capability, mode transition telemetry, and audit in a real browser. It remains browser-qa-pass rather than golden-pass until the implementation is reviewed/merged and retested from a clean integrated branch.
`
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
