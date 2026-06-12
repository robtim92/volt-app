import { useUIStore } from '@stores/uiStore'

// Placeholder panels — each will be replaced by real components in later phases
function PlaceholderPanel({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <span className="text-5xl">⚡</span>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{description}</p>
      <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
        Coming in a future phase
      </span>
    </div>
  )
}

const panels: Record<string, JSX.Element> = {
  lessons: (
    <PlaceholderPanel
      title="Lessons"
      description="Step-by-step interactive lessons, guided labs, and worked examples. Full DC track coming in Phase 2."
    />
  ),
  sandbox: (
    <PlaceholderPanel
      title="Circuit Sandbox"
      description="Drag-and-drop circuit builder with live MNA simulation. This is the Phase 1 MVP — the canvas and solver are next."
    />
  ),
  dashboard: (
    <PlaceholderPanel
      title="Dashboard"
      description="Your learning progress, streak, quiz accuracy, and lesson map. Coming in Phase 3."
    />
  ),
  settings: (
    <PlaceholderPanel
      title="Settings"
      description="Theme, unit system, formula notation, and AI assistant preferences."
    />
  )
}

export default function MainArea(): JSX.Element {
  const activePanel = useUIStore((s) => s.activePanel)
  const content = panels[activePanel] ?? panels['sandbox']

  return (
    <main className="flex-1 overflow-auto bg-white dark:bg-brand-dark">
      {content}
    </main>
  )
}
