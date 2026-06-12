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
    expect(screen.getByText('DC Circuits')).toBeInTheDocument()
    expect(screen.getByText('AC & Residential')).toBeInTheDocument()
    expect(screen.getByText('Digital Computing')).toBeInTheDocument()
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
