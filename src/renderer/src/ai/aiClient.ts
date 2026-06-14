/**
 * Volt — Anthropic API client (AI assistant add-on)
 *
 * Calls the Claude Messages API directly from the client using the user's own
 * API key (stored in settingsStore). This is the v1 transport for both the web
 * and Electron targets; a server-side proxy can replace it later without
 * touching the panel — only `sendChatMessage` needs swapping.
 *
 * `fetchImpl` is injectable so tests can run without a network or a real key.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const DEFAULT_MAX_TOKENS = 1024

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SendChatOptions {
  apiKey: string
  model: string
  /** System prompt (persona + circuit/lesson context). */
  system: string
  /** Conversation so far, oldest first. Must end with a user turn. */
  messages: ChatMessage[]
  maxTokens?: number
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

/** Thrown for any non-OK response or malformed payload, with a usable message. */
export class AIClientError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AIClientError'
    this.status = status
  }
}

interface AnthropicContentBlock {
  type: string
  text?: string
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type?: string; message?: string }
}

/** Send one chat turn and return the assistant's text reply. */
export async function sendChatMessage(opts: SendChatOptions): Promise<string> {
  const { apiKey, model, system, messages, maxTokens = DEFAULT_MAX_TOKENS } = opts
  const doFetch = opts.fetchImpl ?? fetch

  if (!apiKey.trim()) {
    throw new AIClientError('No API key configured. Add one in Settings.')
  }

  let res: Response
  try {
    res = await doFetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        // Required to call the API from a browser/renderer context.
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
    })
  } catch (e) {
    throw new AIClientError(
      `Network error reaching the Claude API: ${(e as Error).message}`
    )
  }

  let data: AnthropicResponse
  try {
    data = (await res.json()) as AnthropicResponse
  } catch {
    throw new AIClientError(`Unexpected response (HTTP ${res.status}).`, res.status)
  }

  if (!res.ok) {
    const msg = data?.error?.message ?? `Request failed (HTTP ${res.status}).`
    throw new AIClientError(msg, res.status)
  }

  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim()

  if (!text) throw new AIClientError('The assistant returned an empty response.')
  return text
}
