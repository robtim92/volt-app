/**
 * Volt — Onboarding placement quiz
 *
 * Shown on first launch to gauge the user's familiarity with DC circuits and
 * recommend a starting lesson. Five quick diagnostic questions; no feedback
 * during the quiz (placement, not teaching). Dismissible at any point.
 */
import { useState } from 'react'
import { useUIStore } from '@stores/uiStore'
import { useLessonStore } from '@stores/lessonStore'

// ── Quiz data ────────────────────────────────────────────────────────────────

interface Question {
  text: string
  choices: string[]
  answerIndex: number
}

const QUESTIONS: Question[] = [
  {
    text: 'What does voltage measure?',
    choices: [
      'The rate of charge flow through a wire',
      'The electrical pressure that pushes current',
      'The opposition to current in a material',
      'The energy stored in a magnetic field'
    ],
    answerIndex: 1
  },
  {
    text: 'A 9 V battery connects to a 3 kΩ resistor. What current flows?',
    choices: ['27 A', '0.3 A', '3 mA', '3 A'],
    answerIndex: 2
  },
  {
    text: 'Three 100 Ω resistors are wired in series. What is the total resistance?',
    choices: ['33 Ω', '100 Ω', '300 Ω', '33.3 Ω'],
    answerIndex: 2
  },
  {
    text: '5 mA flows into a junction. Two branches leave carrying 2 mA and X. What is X?',
    choices: ['7 mA', '2 mA', '5 mA', '3 mA'],
    answerIndex: 3
  },
  {
    text: 'R = 10 kΩ, C = 100 μF. After one time constant, the capacitor has charged to approximately…',
    choices: ['100%', '63%', '50%', '37%'],
    answerIndex: 1
  }
]

/** Map score to a recommended lesson id and label. */
function recommendation(score: number): { lessonId: string; title: string; reason: string } {
  if (score <= 1)
    return {
      lessonId: 'dc-fund-1',
      title: 'Voltage, Current & Resistance',
      reason: "We'll build up from the fundamentals — the concepts will click fast."
    }
  if (score <= 3)
    return {
      lessonId: 'dc-ohm-1',
      title: "Ohm's Law",
      reason: "You've got the basics. Jump straight into the most useful equation in electronics."
    }
  return {
    lessonId: 'dc-kirckhoff-1',
    title: "Kirchhoff's Laws",
    reason: "You clearly know your way around a circuit. Head straight to the advanced material."
  }
}

// ── Screens ──────────────────────────────────────────────────────────────────

function WelcomeScreen({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center max-w-md mx-auto px-6 py-8">
      <span className="text-6xl">⚡</span>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to Volt!</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Five quick questions to figure out where you should start. No wrong answers — we just want
          to point you at the right lesson.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={onStart}
          className="px-6 py-2.5 rounded-lg bg-brand-yellow text-brand-dark font-semibold text-sm hover:brightness-110"
        >
          Let's go →
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Skip — start from the beginning
        </button>
      </div>
    </div>
  )
}

function QuestionScreen({
  question,
  index,
  total,
  onAnswer
}: {
  question: Question
  index: number
  total: number
  onAnswer: (i: number) => void
}): JSX.Element {
  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto px-6 py-8 w-full">
      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < index
                ? 'bg-brand-yellow'
                : i === index
                ? 'bg-brand-yellow/60'
                : 'bg-gray-200 dark:bg-white/10'
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Question {index + 1} of {total}
      </p>

      <h3 className="text-base font-semibold text-gray-900 dark:text-white text-center leading-snug">
        {question.text}
      </h3>

      <div className="flex flex-col gap-2">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => onAnswer(i)}
            className="text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-brand-navy/40 text-sm text-gray-800 dark:text-gray-200 hover:border-brand-yellow/60 hover:bg-brand-yellow/5 transition-colors"
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  )
}

function ResultScreen({
  score,
  total,
  onStart,
  onSkip
}: {
  score: number
  total: number
  onStart: (lessonId: string) => void
  onSkip: () => void
}): JSX.Element {
  const rec = recommendation(score)
  const pct = Math.round((score / total) * 100)

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center max-w-md mx-auto px-6 py-8">
      <span className="text-5xl">{score >= 4 ? '🏆' : score >= 2 ? '👍' : '🌱'}</span>
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          {score} / {total} correct ({pct}%)
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{rec.reason}</p>
      </div>

      <div className="w-full p-4 rounded-xl bg-brand-yellow/10 border border-brand-yellow/30 text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-yellow mb-1">
          Recommended start
        </p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{rec.title}</p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => onStart(rec.lessonId)}
          className="px-6 py-2.5 rounded-lg bg-brand-yellow text-brand-dark font-semibold text-sm hover:brightness-110"
        >
          Start: {rec.title} →
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Start from the beginning instead
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingQuiz(): JSX.Element {
  const completeOnboarding = useUIStore((s) => s.completeOnboarding)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const setActiveLesson = useLessonStore((s) => s.setActiveLesson)

  const [step, setStep] = useState<'welcome' | number | 'results'>('welcome')
  const [answers, setAnswers] = useState<number[]>([])

  const handleAnswer = (choiceIndex: number): void => {
    const newAnswers = [...answers, choiceIndex]
    setAnswers(newAnswers)
    const next = (step as number) + 1
    if (next >= QUESTIONS.length) {
      setStep('results')
    } else {
      setStep(next)
    }
  }

  const dismiss = (lessonId?: string): void => {
    completeOnboarding()
    if (lessonId) {
      setActiveLesson(lessonId)
      setActivePanel('lessons')
    } else {
      setActivePanel('lessons')
    }
  }

  const score = answers.filter((a, i) => a === QUESTIONS[i]?.answerIndex).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-brand-navy rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {step === 'welcome' && (
          <WelcomeScreen
            onStart={() => setStep(0)}
            onSkip={() => dismiss('dc-fund-1')}
          />
        )}
        {typeof step === 'number' && step < QUESTIONS.length && (
          <QuestionScreen
            question={QUESTIONS[step]}
            index={step}
            total={QUESTIONS.length}
            onAnswer={handleAnswer}
          />
        )}
        {step === 'results' && (
          <ResultScreen
            score={score}
            total={QUESTIONS.length}
            onStart={(id) => dismiss(id)}
            onSkip={() => dismiss('dc-fund-1')}
          />
        )}
      </div>
    </div>
  )
}
