import { useUIStore } from '@stores/uiStore'
import SandboxPanel from '@components/sandbox/SandboxPanel'
import LessonsPanel from '@components/lessons/LessonsPanel'
import DashboardPanel from '@components/dashboard/DashboardPanel'
import SettingsPanel from '@components/settings/SettingsPanel'
import CampaignPanel from '@components/campaign/CampaignPanel'

const panels: Record<string, JSX.Element> = {
  campaign: <CampaignPanel />,
  lessons: <LessonsPanel />,
  sandbox: <SandboxPanel />,
  dashboard: <DashboardPanel />,
  settings: <SettingsPanel />
}

export default function MainArea(): JSX.Element {
  const activePanel = useUIStore((s) => s.activePanel)
  const content = panels[activePanel] ?? panels['sandbox']

  return (
    <main className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-brand-dark">
      {content}
    </main>
  )
}
