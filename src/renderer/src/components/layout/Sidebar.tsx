import { useUIStore } from '@stores/uiStore'

type Track = 'dc' | 'ac' | 'digital'

const tracks: { id: Track; label: string; icon: string; subtitle: string }[] = [
  { id: 'dc',      label: 'DC Circuits',       icon: '⚡', subtitle: 'Start here' },
  { id: 'ac',      label: 'AC & Residential',  icon: '🔌', subtitle: 'Wiring & panels' },
  { id: 'digital', label: 'Digital Computing', icon: '🔲', subtitle: 'Logic & CPUs' }
]

export default function Sidebar(): JSX.Element {
  const { activeTrack, setActiveTrack, activePanel, setActivePanel, darkMode, toggleDarkMode } =
    useUIStore()

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200 dark:border-white/10">
        <span className="text-2xl">⚡</span>
        <span className="font-bold text-lg tracking-tight text-brand-navy dark:text-white">
          Volt
        </span>
      </div>

      {/* Tracks */}
      <div className="px-2 py-3">
        <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Tracks
        </p>
        {tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTrack(t.id)}
            className={`nav-item w-full text-left ${activeTrack === t.id ? 'active' : ''}`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="flex flex-col min-w-0">
              <span className="truncate">{t.label}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
                {t.subtitle}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="px-2 py-3 border-t border-gray-200 dark:border-white/10">
        <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Navigate
        </p>
        {[
          { id: 'lessons' as const,  icon: '📖', label: 'Lessons' },
          { id: 'sandbox' as const,  icon: '🔬', label: 'Sandbox' },
          { id: 'dashboard' as const,icon: '📊', label: 'Dashboard' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            className={`nav-item w-full text-left ${activePanel === item.id ? 'active' : ''}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom: Settings + Theme toggle */}
      <div className="mt-auto px-2 py-3 border-t border-gray-200 dark:border-white/10">
        <button
          onClick={toggleDarkMode}
          className="nav-item w-full text-left"
          aria-label="Toggle dark mode"
        >
          <span>{darkMode ? '☀️' : '🌙'}</span>
          <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button
          onClick={() => setActivePanel('settings')}
          className={`nav-item w-full text-left ${activePanel === 'settings' ? 'active' : ''}`}
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
