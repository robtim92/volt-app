import { useUIStore } from '@stores/uiStore'
import { useGameStore } from '@stores/gameStore'
import { rankFor } from '../../game/progression'

const panelTitles: Record<string, string> = {
  campaign:  'Campaign',
  lessons:   'Lessons',
  sandbox:   'Sandbox',
  home:      'Home Power',
  dashboard: 'Dashboard',
  settings:  'Settings'
}

const trackLabels: Record<string, string> = {
  dc:      'DC Circuits',
  ac:      'AC & Residential',
  digital: 'Digital Computing'
}

export default function TopBar({ onMenu }: { onMenu?: () => void } = {}): JSX.Element {
  const { activePanel, activeTrack, setActivePanel } = useUIStore()
  const xp = useGameStore((s) => s.xp)
  const { rank } = rankFor(xp)

  return (
    <header className="h-12 shrink-0 flex items-center px-4 gap-2 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-brand-dark">
      {onMenu && (
        <button
          onClick={onMenu}
          aria-label="Open menu"
          className="-ml-1 mr-1 w-9 h-9 flex items-center justify-center rounded text-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
        >
          ☰
        </button>
      )}
      {/* Breadcrumb */}
      <span className="hidden sm:inline text-sm text-gray-400 dark:text-gray-500">
        {trackLabels[activeTrack]}
      </span>
      <span className="hidden sm:inline text-gray-300 dark:text-gray-600">/</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {panelTitles[activePanel] ?? activePanel}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Rank + XP chip → campaign */}
      <button
        onClick={() => setActivePanel('campaign')}
        title="Your rank — open the campaign"
        className="text-xs px-2.5 py-0.5 rounded-full bg-brand-yellow/10 text-brand-yellow font-medium hover:bg-brand-yellow/20"
      >
        {rank.icon} <span className="hidden sm:inline">{rank.title} · </span>{xp} XP
      </button>
    </header>
  )
}
