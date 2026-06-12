import type { Lesson, TrackId } from './types'
import { DC_LESSONS } from './dcLessons'

export type { Lesson, LessonCard, ConceptCard, QuizCard, CircuitPreset, TrackId } from './types'

/** All lessons, in curriculum order per track. */
export const ALL_LESSONS: Lesson[] = [...DC_LESSONS]

export function getLessonsForTrack(track: TrackId): Lesson[] {
  return ALL_LESSONS.filter((l) => l.track === track)
}

export function getLesson(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id)
}

/** Lessons grouped by module, preserving curriculum order. */
export function getModulesForTrack(track: TrackId): Array<{ module: string; lessons: Lesson[] }> {
  const groups: Array<{ module: string; lessons: Lesson[] }> = []
  for (const lesson of getLessonsForTrack(track)) {
    const last = groups[groups.length - 1]
    if (last && last.module === lesson.module) last.lessons.push(lesson)
    else groups.push({ module: lesson.module, lessons: [lesson] })
  }
  return groups
}
