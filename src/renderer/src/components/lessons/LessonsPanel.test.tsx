import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LessonsPanel from './LessonsPanel'
import { useLessonStore } from '@stores/lessonStore'
import { useUIStore } from '@stores/uiStore'
import { useCircuitStore } from '@stores/circuitStore'
import { getLesson } from '../../lessons'

beforeEach(() => {
  localStorage.clear()
  useLessonStore.setState({ progress: {}, activeLessonId: null, activeCardIndex: 0 })
  useUIStore.setState({ activeTrack: 'dc', activePanel: 'lessons' })
  useCircuitStore.setState({ components: [], wires: [], simResult: null, selectedComponentId: null })
})

describe('LessonsPanel — list view', () => {
  it('lists DC lessons grouped by module', () => {
    render(<LessonsPanel />)
    expect(screen.getByText('Voltage, Current & Resistance')).toBeInTheDocument()
    expect(screen.getByText("Ohm's Law")).toBeInTheDocument()
    expect(screen.getByText('Series Circuits')).toBeInTheDocument()
    expect(screen.getByText('Fundamentals')).toBeInTheDocument()
  })

  it('shows a coming-soon state for tracks without content', () => {
    useUIStore.setState({ activeTrack: 'ac' })
    render(<LessonsPanel />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})

describe('LessonsPanel — player', () => {
  it('opens a lesson and walks through cards', async () => {
    const user = userEvent.setup()
    render(<LessonsPanel />)

    await user.click(screen.getByText('Voltage, Current & Resistance'))
    expect(screen.getByText('Electricity is moving charge')).toBeInTheDocument()
    expect(screen.getByText('1 / 7')).toBeInTheDocument()

    await user.click(screen.getByText('Next'))
    expect(screen.getByText('Voltage is the push')).toBeInTheDocument()
  })

  it('locks quiz answers, shows the explanation, and gates Next', async () => {
    const user = userEvent.setup()
    useLessonStore.setState({ activeLessonId: 'dc-fund-1', activeCardIndex: 4 }) // first quiz
    render(<LessonsPanel />)

    expect(screen.getByText(/bird sits/i)).toBeInTheDocument()
    const next = screen.getByText('Next')
    expect(next).toBeDisabled()

    await user.click(
      screen.getByText('Both feet are at the same voltage, so no current flows through the bird')
    )
    expect(screen.getByText(/Correct!/)).toBeInTheDocument()
    expect(screen.getByText('Next')).not.toBeDisabled()
  })

  it('completes a lesson and records the quiz score', async () => {
    const user = userEvent.setup()
    const lesson = getLesson('dc-fund-1')!
    // jump to the last card (a quiz)
    useLessonStore.setState({
      activeLessonId: lesson.id,
      activeCardIndex: lesson.cards.length - 1
    })
    render(<LessonsPanel />)

    // answer the final quiz correctly
    const lastCard = lesson.cards[lesson.cards.length - 1]
    if (lastCard.type === 'quiz') {
      await user.click(screen.getByText(lastCard.choices[lastCard.answerIndex]))
    }
    await user.click(screen.getByText(/Finish lesson/))

    const progress = useLessonStore.getState().progress[lesson.id]
    expect(progress?.completed).toBe(true)
    // answered 1 of 3 quizzes correctly (the others unanswered) → 33%
    expect(progress?.lastQuizScore).toBe(33)

    // score < 70%: completion screen shows the nudge; click "Continue anyway"
    expect(screen.getByText(/below 70%/i)).toBeInTheDocument()
    await user.click(screen.getByText(/Continue anyway/i))
    expect(useLessonStore.getState().activeLessonId).toBeNull()
  })

  it('loads a lesson circuit into the sandbox', async () => {
    const user = userEvent.setup()
    useLessonStore.setState({ activeLessonId: 'dc-ohm-1', activeCardIndex: 2 }) // "See it live"
    render(<LessonsPanel />)

    await user.click(screen.getByText(/Open the Ohm/))
    const { components } = useCircuitStore.getState()
    expect(components.length).toBeGreaterThan(0)
    expect(components.some((c) => c.type === 'ammeter')).toBe(true)
    expect(useUIStore.getState().activePanel).toBe('sandbox')
  })
})
