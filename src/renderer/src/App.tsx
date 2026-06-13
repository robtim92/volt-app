import { useEffect } from 'react'
import Sidebar from '@components/layout/Sidebar'
import TopBar from '@components/layout/TopBar'
import MainArea from '@components/layout/MainArea'
import OnboardingQuiz from '@components/onboarding/OnboardingQuiz'
import { useUIStore } from '@stores/uiStore'

function App(): JSX.Element {
  const darkMode = useUIStore((s) => s.darkMode)
  const hasOnboarded = useUIStore((s) => s.hasOnboarded)

  // Sync dark mode class on the document root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100 font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <MainArea />
      </div>
      {!hasOnboarded && <OnboardingQuiz />}
    </div>
  )
}

export default App
