import fs from 'node:fs'

const catalog = JSON.parse(fs.readFileSync(new URL('../demos/catalog.json', import.meta.url), 'utf8'))
const liveDemos = catalog.goldenDemos.filter(demo => demo.status === 'live')
const failures = []

for (const demo of liveDemos) {
  try {
    const response = await fetch(demo.liveUrl, { redirect: 'follow' })
    console.log(`${demo.id}: ${response.status} ${response.url}`)
    if (!response.ok) failures.push(`${demo.id} returned HTTP ${response.status}`)
  } catch (error) {
    failures.push(`${demo.id} failed live smoke: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failures.length) {
  console.error('live demo smoke failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`live demo smoke passed (${liveDemos.length} demos)`)
