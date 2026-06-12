import dotenv from 'dotenv'
import path from 'path'
import { execSync } from 'child_process'
import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { sql } from 'kysely'

dotenv.config({ path: path.resolve(process.cwd(), '../.env') })

const WALLET_NAME = process.env.AGENT_WALLET_NAME
const WALLET_ADDRESS = process.env.AGENT_WALLET_ADDRESS
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://forno.celo-sepolia.celo-testnet.org/'

function binWallet(args: string): string {
  return execSync(`./bin/m wallet:${args}`, {
    encoding: 'utf-8',
    cwd: process.cwd(),
    env: { ...process.env, NEXT_PUBLIC_RPC_URL: RPC_URL },
  }).trim()
}

async function main() {
  let allOk = true

  // 1. Database check
  try {
    const db = newKyselyPostgresql()
    const result = await sql<{ one: number }>`SELECT 1 AS one`.execute(db)
    const rows = result.rows
    console.log('✅ Database: connected (SELECT 1 =', rows[0]?.one, ')')
  } catch (e) {
    console.error('❌ Database: connection failed —', (e as Error).message)
    allOk = false
  }

  // 2. Wallet name ↔ address consistency via bin/m
  if (!WALLET_NAME || !WALLET_ADDRESS) {
    console.error('❌ Wallet: AGENT_WALLET_NAME or AGENT_WALLET_ADDRESS not set in .env')
    allOk = false
  } else {
    try {
      const output = binWallet(`list --name ${WALLET_NAME} --address-only`)
      if (output.toLowerCase() !== WALLET_ADDRESS.toLowerCase()) {
        console.error(`❌ Wallet: address mismatch — .env has ${WALLET_ADDRESS} but wallet ${WALLET_NAME} has ${output}`)
        allOk = false
      } else {
        console.log(`✅ Wallet name/address consistent: ${WALLET_NAME} → ${WALLET_ADDRESS}`)
      }
    } catch (e) {
      console.error('❌ Wallet: failed to verify —', (e as Error).message)
      allOk = false
    }
  }

  // 3. Wallet balance via bin/m
  try {
    const output = binWallet(`balance --name ${WALLET_NAME} --rpc ${RPC_URL}`)
    console.log(`✅ Wallet balance: ${output}`)
    if (output.includes('0 S-CELO')) {
      console.warn('⚠️  Wallet balance is 0 — fund it at https://faucet.celo.org/celo-sepolia')
    }
  } catch (e) {
    console.error('❌ Wallet: balance check failed —', (e as Error).message)
    allOk = false
  }

  if (!allOk) {
    process.exit(1)
  }
  console.log('✅ All checks passed')
}

main()
