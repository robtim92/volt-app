/**
 * Volt — AI assistant panel (paid add-on)
 *
 * A collapsible slide-over chat. Hidden entirely until an API key is set in
 * Settings. On each send it assembles the live circuit + lesson context (see
 * ai/context.ts) into the system prompt and calls the Anthropic API directly
 * (ai/aiClient.ts). Non-streaming: one request, one reply.
 */
import { useState, useRef, useEffect } from 'react'
import { useUIStore } from '@stores/uiStore'
import { useCircuitStore } from '@stores/circuitStore'
import { useLessonStore } from '@stores/lessonStore'
import { useSettingsStore, hasApiKey } from '@stores/settingsStore'
import { ALL_LESSONS } from '../../lessons'
import { assembleSystemPrompt } from '../../ai/context'
import { sendChatMessage, type ChatMessage } from '../../ai/aiClient'

const SUGGESTIONS = [
  'Why isn\'t my circuit solving?',
  'Explain what\'s happening in this circuit.',
  'How do I pick the right resistor value?'
]

export default function AIAssistantPanel(): JSX.Element | null {
  const apiKey = useSettingsStore((s) => s.apiKey)
  const aiModel = useSettingsStore((s) => s.aiModel)
  const open = useUIStore((s) => s.aiPanelOpen)
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel)
  const setAIPanelOpen = useUIStore((s) => s.setAIPanelOpen)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, loading])

  // Gate: no key → no assistant UI at all.
  if (!hasApiKey({ apiKey })) return null

  const send = async (text: string): Promise<void> => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setError(null)

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    // Assemble fresh circuit + lesson context at send time.
    const { components, wires, simResult } = useCircuitStore.getState()
    const { progress, activeLessonId } = useLessonStore.getState()
    const system = assembleSystemPrompt({
      components,
      wires,
      sim: simResult,
      progress,
      lessons: ALL_LESSONS,
      activeLessonId
    })

    try {
      const reply = await sendChatMessage({ apiKey, model: aiModel, system, messages: nextMessages })
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={toggleAIPanel}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-brand-yellow text-brand-dark font-semibold hover:brightness-110"
        aria-label="Toggle Volt AI assistant"
      >
        <span className="text-lg">✨</span>
        <span className="text-sm">Volt AI</span>
      </button>

      {/* Slide-over */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-white dark:bg-brand-navy border-l border-gray-200 dark:border-white/10 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">✨</span>
              <span className="font-bold text-gray-900 dark:text-white">Volt AI</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">tutor</span>
            </div>
            <button
              onClick={() => setAIPanelOpen(false)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
              aria-label="Close assistant"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p className="mb-3">
                  Ask me about the circuit on your canvas or the concept you&apos;re learning.
                  I can see your components and their measured currents.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-yellow/60 text-gray-700 dark:text-gray-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-brand-yellow text-brand-dark text-sm whitespace-pre-wrap'
                      : 'max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-100 text-sm whitespace-pre-wrap'
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 text-sm">
                  Thinking…
                </div>
              </div>
            )}

            {error && (
              <div className="px-3 py-2 rounded-lg border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
                {error}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 dark:border-white/10 p-3">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                rows={1}
                placeholder="Ask about your circuit…"
                className="flex-1 resize-none px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 bg-white dark:bg-brand-dark/40 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-brand-yellow max-h-32"
              />
              <button
                onClick={() => void send(input)}
                disabled={!input.trim() || loading}
                className="px-4 py-2 rounded-lg bg-brand-yellow text-brand-dark text-sm font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
