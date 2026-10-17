/**
 * Step-by-step guide shown above the board while an example is loaded. The
 * circuit stays fully editable; the guide just suggests what to try next.
 */
import { useState } from 'react'
import { useUIStore } from '@stores/uiStore'
import { getExample } from '../../examples/examples'
import { useIsMobile } from '../../hooks/useIsMobile'
import { loadExample } from './loadExample'

export default function ExampleGuide(): JSX.Element | null {
  const id = useUIStore((s) => s.activeExampleId)
  const step = useUIStore((s) => s.exampleStep)
  const setStep = useUIStore((s) => s.setExampleStep)
  const close = useUIStore((s) => s.closeExample)
  const openGallery = useUIStore((s) => s.setExamplesOpen)
  const mobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const ex = id ? getExample(id) : undefined
  if (!ex) return null
  const last = ex.steps.length - 1

  return (
    <div className="shrink-0 border-b border-sky-500/30 bg-sky-500/5 px-3 md:px-4 py-2 md:py-2.5" data-testid="example-guide">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-sky-600 dark:text-sky-400">Example</span>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{ex.title}</h2>
        <span className="flex-1" />
        <button onClick={() => setCollapsed((c) => !c)} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          {collapsed ? 'show guide' : 'hide'}
        </button>
        <button onClick={() => openGallery(true)} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          more examples
        </button>
        <button onClick={close} aria-label="Close guide" className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          ✕
        </button>
      </div>
      {!collapsed && (
        <>
          {!mobile && <p className="text-xs italic text-gray-500 dark:text-gray-400 mt-0.5">{ex.concept}</p>}
          <div className="mt-1.5 flex items-start gap-2">
            <span className="shrink-0 mt-0.5 inline-flex w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] font-semibold items-center justify-center">
              {step + 1}
            </span>
            <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug max-w-3xl" data-testid="example-step">
              {ex.steps[step]}
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="px-2.5 py-1 text-xs rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-40"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(Math.min(last, step + 1))}
              disabled={step === last}
              className="px-2.5 py-1 text-xs rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 font-medium disabled:opacity-40"
            >
              Next step →
            </button>
            <span className="text-[11px] text-gray-400">
              {step + 1} / {ex.steps.length}
            </span>
            <span className="flex-1" />
            <button onClick={() => loadExample(ex.id)} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" title="Reload the original circuit">
              ⟲ Reload original
            </button>
          </div>
        </>
      )}
    </div>
  )
}
