/**
 * Tests for generate-and-send.ts (#7)
 *
 * generate-and-send.ts reads pre_alerts (status = 'pending') validated by
 * detect-cases.ts and sends them to sivel.xyz. It no longer calls extractPreAlert
 * directly — that's detect-cases.ts responsibility.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// signMessage reads wallet from disk — mock it for tests
vi.mock('../scripts/generate-and-send', async () => {
  const actual = await vi.importActual('../scripts/generate-and-send') as Record<string, unknown>
  return { ...actual }
})

import { generateAndSend } from '../scripts/generate-and-send'

const VALID_HASH =
  '0xabc0000000000000000000000000000000000000000000000000000000000001'
const VALID_SIG =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

function mockDb(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const executeTakeFirst = overrides.executeTakeFirst || vi.fn()
  const execute = overrides.execute || vi.fn()

  function builder(): Record<string, ReturnType<typeof vi.fn>> {
    return {
      selectFrom: vi.fn(builder),
      select: vi.fn(builder),
      where: vi.fn(builder),
      leftJoin: vi.fn(builder),
      innerJoin: vi.fn(builder),
      limit: vi.fn(builder),
      orderBy: vi.fn(builder),
      returning: vi.fn(builder),
      insertInto: vi.fn(builder),
      values: vi.fn(builder),
      updateTable: vi.fn(builder),
      set: vi.fn(builder),
      executeTakeFirst,
      execute,
    }
  }

  return builder()
}

function mockPreAlert(overrides = {}) {
  return {
    pre_alert_id: 100,
    event_hash: VALID_HASH,
    json_data: { titulo: 'Test', hechos: 'Test hechos', fecha: '2025-06-01' },
    source_url: 'https://example.com/1',
    title: 'Test Article',
    medium: 'Test Medium',
    ...overrides,
  }
}

describe('generateAndSend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SIVEL3_API_URL = ''
    process.env.AGENT_WALLET_NAME = 'sivel3agent-dev'
    process.env.AGENT_WALLET_ADDRESS = '0x8C88169977c180f6380C01daAA9c7F31894c20dc'
    process.env.BATCH_SIZE = '10'
    process.env.DRY_RUN = 'false'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ pre_alert_id: 999 }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.SIVEL3_API_URL = ''
    process.env.DRY_RUN = 'false'
  })

  it('handles empty pending pre_alerts', async () => {
    const db = mockDb({ execute: vi.fn().mockResolvedValue([]) })
    await generateAndSend(db as never)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('dry-run mode skips fetch', async () => {
    process.env.DRY_RUN = 'true'
    process.env.SIVEL3_API_URL = 'https://sivel.xyz:9001'
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockPreAlert()]),
    })
    await generateAndSend(db as never)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('skips send when SIVEL3_API_URL not configured', async () => {
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockPreAlert()]),
    })
    await generateAndSend(db as never)
    expect(fetch).not.toHaveBeenCalled()
  })
})
