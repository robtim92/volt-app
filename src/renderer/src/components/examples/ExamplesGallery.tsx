/**
 * Example circuits gallery: browse by category and load one into the sandbox.
 */
import { useEffect } from 'react'
import { useUIStore } from '@stores/uiStore'
import { useCircuitStore } from '@stores/circuitStore'
import { EXAMPLES, EXAMPLE_CATEGORIES } from '../../examples/examples'
import { loadExample } from './loadExample'

const CATEGORY_NOTE: Record<string, string> = {
  Basics: 'Loops, resistors and the laws that tie them together',
  'Time & energy': 'Capacitors and inductors: circuits that change over time',
  'AC & signals': 'Alternating current, filters and resonance',
  'Protection & safety': 'What breakers and fuses are for'
}

export default function ExamplesGallery(): JSX.Element | null {
  const open = useUIStore((s) => s.examplesOpen)
  const setOpen = useUIStore((s) => s.setExamplesOpen)
  const hasCircuit = useCircuitStore((s) => s.components.length > 0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/50 md:p-6" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Example circuits"
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-3xl max-h-[85dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white dark:bg-brand-navy border border-gray-200 dark:border-white/10 shadow-2xl animate-card-in"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-5 py-4 bg-white/95 dark:bg-brand-navy/95 border-b border-gray-200 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Example circuits</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Load one, follow its guide, then change anything you like.
              {hasCircuit && ' Loading replaces the circuit on the board (Undo brings it back).'}
            </p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close examples" className="w-8 h-8 shrink-0 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">
            ✕
          </button>
        </div>
        <div className="px-5 py-4 space-y-6">
          {EXAMPLE_CATEGORIES.map((cat) => (
            <section key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{cat}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{CATEGORY_NOTE[cat]}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {EXAMPLES.filter((e) => e.category === cat).map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => loadExample(ex.id)}
                    className="text-left rounded-xl border border-gray-200 dark:border-white/10 p-3 hover:border-brand-yellow/60 hover:bg-brand-yellow/5 transition-colors"
                    data-testid={`example-${ex.id}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{ex.title}</span>
                      <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${ex.level === 'Beginner' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'}`}>
                        {ex.level}
                      </span>
                    </span>
                    <span className="block mt-1 text-xs text-gray-600 dark:text-gray-300">{ex.summary}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
