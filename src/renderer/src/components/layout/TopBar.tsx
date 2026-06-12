import { useUIStore } from '@stores/uiStore'

const panelTitles: Record<string, string> = {
  lessons:   'Lessons',
  sandbox:   'Sandbox',
  dashboard: 'Dashboard',
  settings:  'Settings'
}

const trackLabels: Record<string, string> = {
  dc:      'DC Circuits',
  ac:      'AC & Residential',
  digital: 'Digital Computing'
}

export default function TopBar(): JSX.Element {
  const { activePanel, activeTrack } = useUIStore()

  return (
    <header className="h-12 shrink-0 flex items-center px-4 gap-2 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-brand-dark">
      {/* Breadcrumb */}
      <span className="text-sm text-gray-400 dark:text-gray-500">
        {trackLabels[activeTrack]}
      </span>
      <span className="text-gray-300 dark:text-gray-600">/</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {panelTitles[activePanel] ?? activePanel}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Phase badge — placeholder until real progress exists */}
      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-yellow/10 text-brand-yellow font-medium">
        Phase 1 · MVP
      </span>
    </header>
  )
}
