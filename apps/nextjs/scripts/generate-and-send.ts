import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'
import { Kysely } from 'kysely'
import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { extractPreAlert } from '../lib/extractPreAlert'

const SIVEL3_API_URL = process.env.SIVEL3_API_URL
const AGENT_WALLET_NAME = process.env.AGENT_WALLET_NAME || 'sivel3agent-dev'
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10')

async function signMessage(message: string): Promise<string> {
  // Read wallet JSON from ~/.m/wallets/<name>.json
  const walletPath = resolve(homedir(), '.m', 'wallets', `${AGENT_WALLET_NAME}.json`)
  let wallet: { privateKey?: string; address?: string }
  try {
    wallet = JSON.parse(readFileSync(walletPath, 'utf-8'))
  } catch {
    throw new Error(`Wallet not found: ${walletPath}`)
  }
  if (!wallet.privateKey) {
    throw new Error(`Wallet "${AGENT_WALLET_NAME}" has no private key`)
  }
  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`)
  return account.signMessage({ message })
}

async function sendToSivel3(preAlert: {
  json: object
  eventHash: string
  sourceUrl: string
  preAlertId: number
}): Promise<number | null> {
  if (!SIVEL3_API_URL) {
    console.log(`  📡 sivel.xyz not configured — skipping send (local ID: ${preAlert.preAlertId})`)
    return null
  }

  const timestamp = new Date().toISOString()
  const message = `${preAlert.eventHash}:${timestamp}`
  const signature = await signMessage(message)

  console.log(`  📡 Sending to sivel.xyz (signed by ${AGENT_WALLET_NAME})…`)

  // sivel.xyz expects { titulo, hechos } at root level of json_data.
  // LLM generates Noche y Niebla format { relatos: [{ titulo, hechos, ... }] }.
  const relato = (preAlert.json as Record<string, unknown>)?.relatos as Record<string, unknown>[] | undefined
  const flat = relato?.[0]
  const jsonData = flat
    ? {
        titulo: (flat.titulo as string) || '',
        hechos: (flat.hechos as string) || '',
        fecha: (flat.fecha as string) || '',
        departamento: (flat.departamento as string) || '',
        municipio: (flat.municipio as string) || '',
        agresion_particular: (flat.agresion_particular as string) || '',
      }
    : preAlert.json

  const response = await fetch(`${SIVEL3_API_URL}/api/pre-alerts/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Signature': signature,
      'X-Agent-Timestamp': timestamp,
    },
    body: JSON.stringify({
      event_hash: preAlert.eventHash,
      json_data: jsonData,
      publisher_wallet: process.env.AGENT_WALLET_ADDRESS || '',
      source_urls: [preAlert.sourceUrl],
      source_summary: `sivel3agent auto-generated`,
    }),
  })

  if (response.status === 409) {
    console.log(`  ⚠️  Duplicate on sivel.xyz (event_hash already exists)`)
    return null
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`sivel.xyz returned ${response.status}: ${error}`)
  }

  const data = (await response.json()) as { pre_alert_id: number }
  console.log(`  ✅ sivel.xyz ID: ${data.pre_alert_id}`)
  return data.pre_alert_id
}

async function generateAndSend(dbOverride?: Kysely<unknown>) {
  const db = dbOverride || newKyselyPostgresql()
  const startTime = new Date().toISOString()
  const dryRun = process.env.DRY_RUN === 'true'
  const apiUrl = process.env.SIVEL3_API_URL

  console.log(`[generate-and-send] Starting at ${startTime}`)
  console.log(`  Agent wallet: ${AGENT_WALLET_NAME}`)
  console.log(`  Batch size: ${BATCH_SIZE}`)
  console.log(`  Dry run: ${dryRun}`)
  console.log(`  sivel.xyz API: ${apiUrl || 'not configured'}`)

  // Read pre_alerts already validated by detect-cases.ts (status = 'pending')
  const preAlerts = await db
    .selectFrom('pre_alert')
    .innerJoin('pre_alert_source', 'pre_alert_source.pre_alert_id', 'pre_alert.id')
    .innerJoin('source', 'source.id', 'pre_alert_source.source_id')
    .select([
      'pre_alert.id as pre_alert_id',
      'pre_alert.event_hash',
      'pre_alert.json_data',
      'source.url as source_url',
      'source.title',
      'source.medium',
    ])
    .where('pre_alert.status', '=', 'pending')
    .limit(BATCH_SIZE)
    .execute()

  console.log(`\nFound ${preAlerts.length} pending pre_alerts.\n`)

  let sent = 0
  let skipped = 0

  for (const pa of preAlerts) {
    console.log(`📄 ${(pa.title as string)?.slice(0, 80) || '(no title)'}`)
    console.log(`   Source: ${pa.medium} | Pre-alert ID: ${pa.pre_alert_id}`)

    try {
      if (dryRun) {
        console.log(`   🔍 Dry run — would send to sivel.xyz.`)
        sent++
        continue
      }

      if (!apiUrl) {
        console.log(`   📡 sivel.xyz not configured — skipping send`)
        skipped++
        continue
      }

      // Send to sivel.xyz
      const remoteId = await sendToSivel3({
        json: (pa.json_data as Record<string, unknown>) || {},
        eventHash: pa.event_hash,
        sourceUrl: pa.source_url as string,
        preAlertId: pa.pre_alert_id as number,
      })

      if (remoteId !== null) {
        // Mark as synced
        await db
          .updateTable('pre_alert')
          .set({ status: 'synced' })
          .where('id', '=', pa.pre_alert_id as number)
          .execute()
        sent++
      } else {
        skipped++
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err instanceof Error ? err.message : err}`)
      skipped++
    }
  }

  const endTime = new Date().toISOString()
  console.log(`\n[generate-and-send] Finished at ${endTime}`)
  console.log(`   Sent to sivel.xyz: ${sent} | Skipped: ${skipped}`)
}

const isMain = process.argv[1]?.includes('generate-and-send')
if (isMain) {
  generateAndSend()
    .then(() => process.exit(0))
    .catch((e) => { console.error('Fatal:', e); process.exit(1) })
}

export { generateAndSend, signMessage }
