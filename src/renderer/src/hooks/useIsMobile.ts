/**
 * True on phone-width screens (< 768 px, Tailwind's `md` breakpoint). Layouts
 * use it to swap side panels for drawers and bottom sheets.
 */
import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

const matches = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(matches)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const onChange = (): void => setMobile(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return mobile
}
