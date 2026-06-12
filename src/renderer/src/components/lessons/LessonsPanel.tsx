/**
 * Volt — Lessons panel
 *
 * List view: lessons for the active track, grouped by module, with progress.
 * Player view: one card at a time — concept cards advance freely; quiz cards
 * lock in your first answer (that's what counts toward the lesson score),
 * show the explanation, then let you move on. Finishing the last card marks
 * the lesson complete and records the quiz score.
 */
import { useState } from 'react'
import { useLessonStore } from '@stores/lessonStore'
import { useUIStore } from '@stores/uiStore'
import { useCircuitStore } from '@stores/circuitStore'
import { getLesson, getModulesForTrack, type Lesson, type LessonCard } from '../../lessons'
import type { CircuitPreset } from '../../lessons/types'

// ── List view ────────────────────────────────────────────────────────────────

function LessonList(): JSX.Element {
  const activeTrack = useUIStore((s) => s.activeTrack)
  const progress = useLessonStore((s) => s.progress)
  const setActiveLesson = useLessonStore((s) => s.setActiveLesson)

  const modules = getModulesForTrack(activeTrack)

  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <span className="text-5xl">📚</span>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          Lessons coming soon
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          {activeTrack === 'ac'
            ? 'The AC & Residential track arrives in Phase 4 — after the DC track is complete.'
            : 'The Digital Computing track arrives in Phase 5. Start with DC Circuits to build the fundamentals.'}
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">DC Circuits</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          From “what is a volt?” to building real circuits — every lesson pairs theory with the
          live simulator.
        </p>

        {modules.map(({ module, lessons }) => (
          <div key={module} className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
              {module}
            </h2>
            <div className="flex flex-col gap-2">
              {lessons.map((lesson) => {
                const p = progress[lesson.id]
                return (
                  <button
                    key={lesson.id}
                    onClick={() => setActiveLesson(lesson.id)}
                    className="text-left p-4 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-yellow/60 dark:hover:border-brand-yellow/60 bg-white dark:bg-brand-navy/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {p?.completed ? '✅' : '⚡'}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-yellow transition-colors">
                          {lesson.title}
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
                          {lesson.summary}
                        </span>
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        {p?.completed && p.lastQuizScore !== undefined
                          ? `Quiz ${p.lastQuizScore}%`
                          : `~${lesson.estMinutes} min`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Player view ──────────────────────────────────────────────────────────────

function QuizCardView({
  card,
  chosen,
  onChoose
}: {
  card: Extract<LessonCard, { type: 'quiz' }>
  chosen: number | undefined
  onChoose: (index: number) => void
}): JSX.Element {
  const answered = chosen !== undefined
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {card.question}
      </h3>
      <div className="flex flex-col gap-2 mb-4">
        {card.choices.map((choice, i) => {
          let style =
            'border-gray-200 dark:border-white/10 hover:border-brand-yellow/60 bg-white dark:bg-brand-navy/40'
          if (answered) {
            if (i === card.answerIndex) {
              style = 'border-green-500 bg-green-500/10'
            } else if (i === chosen) {
              style = 'border-red-500 bg-red-500/10'
            } else {
              style = 'border-gray-200 dark:border-white/10 opacity-60'
            }
          }
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => onChoose(i)}
              className={`text-left px-4 py-3 rounded-lg border text-sm text-gray-800 dark:text-gray-200 transition-colors ${style} ${answered ? 'cursor-default' : ''}`}
            >
              {choice}
            </button>
          )
        })}
      </div>
      {answered && (
        <div
          className={`p-3 rounded-lg text-sm ${
            chosen === card.answerIndex
              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
          }`}
        >
          <span className="font-semibold">
            {chosen === card.answerIndex ? 'Correct! ' : 'Not quite. '}
          </span>
          {card.explanation}
        </div>
      )}
    </div>
  )
}

function LessonPlayer({ lesson }: { lesson: Lesson }): JSX.Element {
  const cardIndex = useLessonStore((s) => s.activeCardIndex)
  const setActiveCard = useLessonStore((s) => s.setActiveCard)
  const setActiveLesson = useLessonStore((s) => s.setActiveLesson)
  const markLessonComplete = useLessonStore((s) => s.markLessonComplete)
  const recordQuizScore = useLessonStore((s) => s.recordQuizScore)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const loadCircuitData = useCircuitStore((s) => s.loadCircuitData)

  // first answer per quiz card index — this is what scores
  const [answers, setAnswers] = useState<Record<number, number>>({})

  const card = lesson.cards[Math.min(cardIndex, lesson.cards.length - 1)]
  const isLast = cardIndex >= lesson.cards.length - 1
  const quizAnswered = card.type !== 'quiz' || answers[cardIndex] !== undefined

  const openCircuit = (preset: CircuitPreset): void => {
    // deep-clone so sandbox edits never touch the lesson content
    const copy = JSON.parse(JSON.stringify(preset)) as CircuitPreset
    loadCircuitData(copy.components, copy.wires)
    setActivePanel('sandbox')
  }

  const finish = (): void => {
    const quizIndices = lesson.cards
      .map((c, i) => (c.type === 'quiz' ? i : -1))
      .filter((i) => i >= 0)
    if (quizIndices.length > 0) {
      const correct = quizIndices.filter(
        (i) => answers[i] === (lesson.cards[i] as Extract<LessonCard, { type: 'quiz' }>).answerIndex
      ).length
      recordQuizScore(lesson.id, Math.round((correct / quizIndices.length) * 100))
    }
    markLessonComplete(lesson.id)
    setActiveLesson(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-white/10">
        <button
          onClick={() => setActiveLesson(null)}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-brand-yellow"
        >
          ← All lessons
        </button>
        <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
          {lesson.title}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {cardIndex + 1} / {lesson.cards.length}
        </span>
      </div>

      {/* progress bar */}
      <div className="shrink-0 h-1 bg-gray-100 dark:bg-white/5">
        <div
          className="h-full bg-brand-yellow transition-all duration-300"
          style={{ width: `${((cardIndex + 1) / lesson.cards.length) * 100}%` }}
        />
      </div>

      {/* card */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {card.type === 'concept' ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {card.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line mb-6">
                {card.body}
              </p>
              {card.circuit && (
                <button
                  onClick={() => openCircuit(card.circuit!)}
                  className="px-4 py-2 rounded-lg bg-brand-yellow/20 text-brand-yellow font-medium text-sm hover:bg-brand-yellow/30"
                >
                  ⚡ {card.circuitLabel ?? 'Try it in the sandbox'}
                </button>
              )}
            </div>
          ) : (
            <QuizCardView
              card={card}
              chosen={answers[cardIndex]}
              onChoose={(i) => setAnswers((a) => ({ ...a, [cardIndex]: i }))}
            />
          )}
        </div>
      </div>

      {/* nav */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-white/10">
        <button
          onClick={() => setActiveCard(Math.max(0, cardIndex - 1))}
          disabled={cardIndex === 0}
          className="px-4 py-1.5 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Back
        </button>
        {isLast ? (
          <button
            onClick={finish}
            disabled={!quizAnswered}
            className="px-4 py-1.5 text-sm rounded bg-brand-yellow text-brand-dark font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Finish lesson ✓
          </button>
        ) : (
          <button
            onClick={() => setActiveCard(cardIndex + 1)}
            disabled={!quizAnswered}
            className="px-4 py-1.5 text-sm rounded bg-brand-yellow text-brand-dark font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        )}
      </div>
    </div>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function LessonsPanel(): JSX.Element {
  const activeLessonId = useLessonStore((s) => s.activeLessonId)
  const lesson = activeLessonId ? getLesson(activeLessonId) : undefined

  if (lesson) return <LessonPlayer key={lesson.id} lesson={lesson} />
  return <LessonList />
}
