/**
 * Volt — Dashboard panel
 *
 * Shows learning progress for all tracks: lessons completed, average quiz
 * accuracy, and a "Continue" shortcut to the next unfinished lesson.
 */
import { useLessonStore } from '@stores/lessonStore'
import { useUIStore } from '@stores/uiStore'
import { getLessonsForTrack, getModulesForTrack } from '../../lessons'

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

function ProgressBar({ value, max }: { value: number; max: number }): JSX.Element {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-brand-yellow transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Needs Review section ──────────────────────────────────────────────────────

function NeedsReviewSection(): JSX.Element | null {
  const progress = useLessonStore((s) => s.progress)
  const setActiveLesson = useLessonStore((s) => s.setActiveLesson)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const dcLessons = getLessonsForTrack('dc')

  const needsReview = dcLessons.filter(
    (l) => progress[l.id]?.completed && (progress[l.id]?.lastQuizScore ?? 100) < 70
  )

  if (needsReview.length === 0) return null

  const openLesson = (id: string): void => {
    setActiveLesson(id)
    setActivePanel('lessons')
  }

  return (
    <div className="mb-10">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Needs Review</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        You scored below 70% on these — worth a second look.
      </p>
      <div className="flex flex-col gap-2">
        {needsReview.map((lesson) => {
          const score = progress[lesson.id]?.lastQuizScore
          return (
            <button
              key={lesson.id}
              onClick={() => openLesson(lesson.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-left hover:border-amber-400 dark:hover:border-amber-500/70 transition-colors group"
            >
              <span className="text-base shrink-0">📝</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand-yellow transition-colors truncate">
                  {lesson.title}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{lesson.module}</span>
              </span>
              {score !== undefined && (
                <span className={`text-xs font-semibold shrink-0 ${scoreColor(score)}`}>
                  {score}%
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── DC track section ─────────────────────────────────────────────────────────

function DCTrackSection(): JSX.Element {
  const progress = useLessonStore((s) => s.progress)
  const setActiveLesson = useLessonStore((s) => s.setActiveLesson)
  const setActivePanel = useUIStore((s) => s.setActivePanel)

  const dcLessons = getLessonsForTrack('dc')
  const dcModules = getModulesForTrack('dc')

  const completedLessons = dcLessons.filter((l) => progress[l.id]?.completed)
  const scores = completedLessons
    .map((l) => progress[l.id]?.lastQuizScore)
    .filter((s): s is number => s !== undefined)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const nextLesson = dcLessons.find((l) => !progress[l.id]?.completed)

  const openLesson = (id: string): void => {
    setActiveLesson(id)
    setActivePanel('lessons')
  }

  return (
    <div className="mb-10">
      {/* Track header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">DC Circuits</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {completedLessons.length} / {dcLessons.length} lessons
        </span>
      </div>
      <ProgressBar value={completedLessons.length} max={dcLessons.length} />

      {/* Stats row */}
      <div className="flex items-center gap-6 mt-3 mb-5">
        {avgScore !== null && (
          <span className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Avg quiz </span>
            <span className={`font-semibold ${scoreColor(avgScore)}`}>{avgScore}%</span>
          </span>
        )}
        {nextLesson && (
          <button
            onClick={() => openLesson(nextLesson.id)}
            className="ml-auto text-sm px-4 py-1.5 rounded-lg bg-brand-yellow text-brand-dark font-semibold hover:brightness-110 shrink-0"
          >
            Continue: {nextLesson.title} →
          </button>
        )}
        {!nextLesson && dcLessons.length > 0 && (
          <span className="ml-auto text-sm text-green-600 dark:text-green-400 font-semibold">
            Track complete ✓
          </span>
        )}
      </div>

      {/* Module breakdown */}
      {dcModules.map(({ module, lessons }) => {
        const moduleCompleted = lessons.filter((l) => progress[l.id]?.completed).length
        return (
          <div key={module} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {module}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {moduleCompleted}/{lessons.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {lessons.map((lesson) => {
                const p = progress[lesson.id]
                const done = p?.completed ?? false
                return (
                  <button
                    key={lesson.id}
                    onClick={() => openLesson(lesson.id)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-yellow/60 bg-white dark:bg-brand-navy/40 text-left transition-colors group"
                  >
                    <span className="text-base shrink-0">{done ? '✅' : '⚡'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand-yellow transition-colors truncate">
                        {lesson.title}
                      </span>
                      {!done && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          ~{lesson.estMinutes} min
                        </span>
                      )}
                    </span>
                    {done && p?.lastQuizScore !== undefined && (
                      <span className={`text-xs font-semibold shrink-0 ${scoreColor(p.lastQuizScore)}`}>
                        {p.lastQuizScore}%
                      </span>
                    )}
                    {done && p?.lastQuizScore === undefined && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">done</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Coming-soon track card ───────────────────────────────────────────────────

function ComingSoonTrack({ title, phase }: { title: string; phase: number }): JSX.Element {
  return (
    <div className="mb-6 p-4 rounded-lg border border-dashed border-gray-200 dark:border-white/10">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-400 dark:text-gray-500">{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500">
          Phase {phase}
        </span>
      </div>
    </div>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function DashboardPanel(): JSX.Element {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Your Progress</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Track your learning across all three circuits tracks.
        </p>

        <NeedsReviewSection />

        <DCTrackSection />

        <ComingSoonTrack title="AC & Residential" phase={4} />
        <ComingSoonTrack title="Digital Computing" phase={5} />
      </div>
    </div>
  )
}
