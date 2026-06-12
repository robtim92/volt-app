import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App shell', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(document.getElementById('root') ?? document.body).toBeTruthy()
  })

  it('shows the Volt brand name in the sidebar', () => {
    render(<App />)
    expect(screen.getByText('Volt')).toBeInTheDocument()
  })

  it('renders all three track names', () => {
    render(<App />)
    // Track names can appear in both the sidebar and the breadcrumb
    expect(screen.getAllByText('DC Circuits').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AC & Residential').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Digital Computing').length).toBeGreaterThan(0)
  })

  it('toggles dark mode when the theme button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByLabelText('Toggle dark mode')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    await user.click(toggle)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
