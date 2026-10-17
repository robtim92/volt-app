import { useEffect, useState } from 'react'
import Sidebar from '@components/layout/Sidebar'
import TopBar from '@components/layout/TopBar'
import MainArea from '@components/layout/MainArea'
import OnboardingQuiz from '@components/onboarding/OnboardingQuiz'
import AIAssistantPanel from '@components/ai/AIAssistantPanel'
import { useUIStore } from '@stores/uiStore'
import { useIsMobile } from './hooks/useIsMobile'

function App(): JSX.Element {
  const darkMode = useUIStore((s) => s.darkMode)
  const hasOnboarded = useUIStore((s) => s.hasOnboarded)
  const mobile = useIsMobile()
  const [navOpen, setNavOpen] = useState(false)

  // Sync dark mode class on the document root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100 font-sans">
      {mobile ? (
        navOpen && (
          <div className="fixed inset-0 z-50 flex" role="dialog" aria-label="Menu">
            <div className="h-full shadow-2xl animate-card-in">
              <Sidebar onNavigate={() => setNavOpen(false)} />
            </div>
            <button
              className="flex-1 bg-black/50"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
            />
          </div>
        )
      ) : (
        <Sidebar />
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onMenu={mobile ? () => setNavOpen(true) : undefined} />
        <MainArea />
      </div>
      {!hasOnboarded && <OnboardingQuiz />}
      <AIAssistantPanel />
    </div>
  )
}

export default App
