/** Segmented control: schematic / split / 3D bench. */
import { useUIStore, type BenchView } from '@stores/uiStore'

const OPTIONS: { id: BenchView; label: string; short: string; title: string }[] = [
  { id: '2d', label: 'Schematic', short: '2D', title: 'Schematic only' },
  { id: 'split', label: 'Split', short: 'Both', title: 'Schematic and 3D bench together' },
  { id: '3d', label: '3D Bench', short: '3D', title: '3D workbench only' }
]

export default function ViewToggle(): JSX.Element {
  const view = useUIStore((s) => s.benchView)
  const setView = useUIStore((s) => s.setBenchView)
  return (
    <div className="flex rounded overflow-hidden border border-gray-300 dark:border-white/15" role="group" aria-label="Sandbox view">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => setView(o.id)}
          title={o.title}
          aria-pressed={view === o.id}
          className={`px-2 py-1 text-xs ${
            view === o.id
              ? 'bg-brand-yellow/25 text-brand-yellow font-medium'
              : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
          }`}
        >
          <span className="hidden md:inline">{o.label}</span>
          <span className="md:hidden">{o.short}</span>
        </button>
      ))}
    </div>
  )
}
