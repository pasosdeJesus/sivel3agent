#!/usr/bin/env node
// Helper: sign and send a pre-alert to the sync endpoint.
// Usage: node scripts/send-pre-alert.mjs [event_id]

import { createWalletClient, http, keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celoSepolia } from 'viem/chains'

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY
if (!PRIVATE_KEY) {
  console.error('Set AGENT_PRIVATE_KEY in environment')
  process.exit(1)
}

const API_URL = process.env.SIVEL_API_URL || 'http://localhost:3000'
const eventId = process.argv[2] || `test-${Date.now()}`
const eventHash = keccak256(toHex(eventId))

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`)
const timestamp = new Date().toISOString()
const message = `${eventHash}:${timestamp}`
const signature = await account.signMessage({ message })

const body = {
  event_hash: eventHash,
  json_data: {
    titulo: `Pre-alerta de prueba: ${eventId}`,
    hechos: `Evento de prueba generado por sivel3agent el ${timestamp}`,
    fecha: new Date().toISOString().split('T')[0],
    departamento: 'Putumayo',
    municipio: 'Mocoa',
  },
  publisher_wallet: account.address,
  source_urls: ['https://example.com/test-source'],
  source_summary: 'Fuente de prueba — sivel3agent smoke test',
}

console.log(`\nEnviando a ${API_URL}/api/pre-alerts/sync ...`)
console.log(`  event_hash: ${eventHash}`)
console.log(`  timestamp:  ${timestamp}`)
console.log(`  publisher:  ${account.address}`)
console.log()

const res = await fetch(`${API_URL}/api/pre-alerts/sync`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Signature': signature,
    'X-Agent-Timestamp': timestamp,
  },
  body: JSON.stringify(body),
})

const result = await res.json()
console.log(`Response ${res.status}:`, JSON.stringify(result, null, 2))
