import { describe, it, expect, vi } from 'vitest'
import { sendChatMessage, AIClientError } from './aiClient'

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as unknown as Response
}

const base = {
  apiKey: 'sk-ant-test',
  model: 'claude-haiku-4-5-20251001',
  system: 'sys',
  messages: [{ role: 'user' as const, content: 'hi' }]
}

describe('sendChatMessage', () => {
  it('sends the right request and returns assistant text', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ content: [{ type: 'text', text: 'Hello there.' }] })
    ) as unknown as typeof fetch

    const reply = await sendChatMessage({ ...base, fetchImpl })
    expect(reply).toBe('Hello there.')

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('/v1/messages')
    expect(init.headers['x-api-key']).toBe('sk-ant-test')
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse(init.body)
    expect(body.model).toBe(base.model)
    expect(body.system).toBe('sys')
    expect(body.messages).toHaveLength(1)
  })

  it('concatenates multiple text blocks', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] })
    ) as unknown as typeof fetch
    expect(await sendChatMessage({ ...base, fetchImpl })).toBe('ab')
  })

  it('throws a friendly error on an API error response', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: 'invalid x-api-key' } }, false, 401)
    ) as unknown as typeof fetch
    await expect(sendChatMessage({ ...base, fetchImpl })).rejects.toThrow(/invalid x-api-key/)
  })

  it('rejects when no API key is configured', async () => {
    await expect(sendChatMessage({ ...base, apiKey: '  ' })).rejects.toBeInstanceOf(AIClientError)
  })

  it('wraps network failures', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    await expect(sendChatMessage({ ...base, fetchImpl })).rejects.toThrow(/Network error/)
  })
})
