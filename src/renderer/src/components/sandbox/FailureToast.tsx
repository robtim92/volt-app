/**
 * Pops up the teaching message when a part burns out, a fuse blows or a breaker trips.
 */
import { useEffect } from 'react'
import { useLiveSimStore } from '@stores/liveSimStore'

export default function FailureToast(): JSX.Element | null {
  const message = useLiveSimStore((s) => s.lastMessage)
  const dismiss = useLiveSimStore((s) => s.dismissMessage)
  useEffect(() => {
    if (!message) return
    const t = setTimeout(dismiss, 9000)
    return () => clearTimeout(t)
  }, [message, dismiss])
  if (!message) return null
  return (
    <div
      role="alert"
      className="absolute left-1/2 -translate-x-1/2 top-3 z-20 max-w-lg px-4 py-2.5 rounded-lg shadow-lg bg-gray-900/95 text-gray-100 text-sm border border-orange-500/60 flex items-start gap-3"
    >
      <span className="flex-1">{message}</span>
      <button onClick={dismiss} aria-label="Dismiss" className="text-gray-400 hover:text-white">
        ✕
      </button>
    </div>
  )
}
