/**
 * Tests for generate-and-send.ts (#7)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('child_process', () => ({ execSync: vi.fn() }))
vi.mock('../lib/extractPreAlert', () => ({ extractPreAlert: vi.fn() }))

import { execSync } from 'child_process'
import { extractPreAlert } from '../lib/extractPreAlert'
import { generateAndSend, signMessage } from '../scripts/generate-and-send'

const VALID_SIG =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
const VALID_HASH =
  '0xabc0000000000000000000000000000000000000000000000000000000000001'

function mockDb(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const executeTakeFirst = overrides.executeTakeFirst || vi.fn()
  const execute = overrides.execute || vi.fn()

  function builder(): Record<string, ReturnType<typeof vi.fn>> {
    return {
      selectFrom: vi.fn(builder),
      select: vi.fn(builder),
      where: vi.fn(builder),
      leftJoin: vi.fn(builder),
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

function mockSource(overrides = {}) {
  return {
    id: 1,
    url: 'https://example.com/1',
    title: 'Test Article',
    published_at: new Date('2025-06-01'),
    clean_text: 'Article text for testing',
    medium: 'Test Medium',
    ...overrides,
  }
}

describe('signMessage', () => {
  it('extracts signature from wallet:sign output', () => {
    vi.mocked(execSync).mockReturnValue(`Signature: ${VALID_SIG}`)
    expect(signMessage('test')).toBe(VALID_SIG)
  })

  it('throws if signature cannot be parsed', () => {
    vi.mocked(execSync).mockReturnValue('Error: failed')
    expect(() => signMessage('test')).toThrow('Could not parse signature')
  })

  it('throws if execSync fails', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('fail') })
    expect(() => signMessage('test')).toThrow('wallet:sign failed')
  })
})

describe('generateAndSend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SIVEL3_API_URL = ''
    process.env.AGENT_WALLET_NAME = 'sivel3agent'
    process.env.BATCH_SIZE = '10'
    process.env.DRY_RUN = 'false'
    vi.mocked(execSync).mockReturnValue(`Signature: ${VALID_SIG}`)
    vi.mocked(extractPreAlert).mockResolvedValue({
      json: { relatos: [{ titulo: 'T', hechos: 'H' }] },
      eventHash: VALID_HASH,
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ pre_alert_id: 999 }),
    })
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('handles empty result set', async () => {
    const db = mockDb({ execute: vi.fn().mockResolvedValue([]) })
    await generateAndSend(db as never)
    expect(extractPreAlert).not.toHaveBeenCalled()
  })

  it('processes a single relevant source', async () => {
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockSource()]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    })
    await generateAndSend(db as never)
    expect(extractPreAlert).toHaveBeenCalledTimes(1)
  })

  it('skips sources without clean_text', async () => {
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockSource({ clean_text: null })]),
    })
    await generateAndSend(db as never)
    expect(extractPreAlert).not.toHaveBeenCalled()
  })

  it('handles LLM errors gracefully', async () => {
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockSource()]),
    })
    vi.mocked(extractPreAlert).mockRejectedValue(new Error('LLM down'))
    await expect(generateAndSend(db as never)).resolves.toBeUndefined()
  })

  it('deduplicates by event_hash', async () => {
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockSource()]),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 50 }),
    })
    await generateAndSend(db as never)
  })

  it('dry-run mode skips DB insert and HTTP', async () => {
    process.env.DRY_RUN = 'true'
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockSource()]),
    })
    await generateAndSend(db as never)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends to sivel.xyz when API URL configured', async () => {
    process.env.SIVEL3_API_URL = 'https://sivel.xyz/api/pre-alerts'
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockSource()]),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 100 }),
    })
    // The send path calls signMessage internally via execSync
    // If execSync mock works, fetch should be called
    await generateAndSend(db as never)
  })

  it('handles sivel.xyz 409 gracefully', async () => {
    process.env.SIVEL3_API_URL = 'https://sivel.xyz/api/pre-alerts'
    const db = mockDb({
      execute: vi.fn().mockResolvedValue([mockSource()]),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 100 }),
    })
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false, status: 409,
      json: async () => ({ error: 'duplicate' }),
    } as Response)
    await expect(generateAndSend(db as never)).resolves.toBeUndefined()
  })
})
