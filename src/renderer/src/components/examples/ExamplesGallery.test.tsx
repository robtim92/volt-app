import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExamplesGallery from './ExamplesGallery'
import ExampleGuide from './ExampleGuide'
import { useUIStore } from '@stores/uiStore'
import { useCircuitStore } from '@stores/circuitStore'
import { useLiveSimStore } from '@stores/liveSimStore'
import { EXAMPLES } from '../../examples/examples'

beforeEach(() => {
  useUIStore.setState({ examplesOpen: true, activeExampleId: null, exampleStep: 0, activeLevelId: null })
  useCircuitStore.setState({ components: [], wires: [], past: [], future: [] })
})

describe('examples gallery + guide', () => {
  it('lists every example', () => {
    render(<ExamplesGallery />)
    for (const ex of EXAMPLES) expect(screen.getByTestId(`example-${ex.id}`)).toBeInTheDocument()
  })

  it('loads an example with its settings and walks its guide', () => {
    render(
      <>
        <ExamplesGallery />
        <ExampleGuide />
      </>
    )
    fireEvent.click(screen.getByTestId('example-half-wave-rectifier'))
    expect(useUIStore.getState().examplesOpen).toBe(false)
    expect(useUIStore.getState().activeExampleId).toBe('half-wave-rectifier')
    expect(useUIStore.getState().scopeOpen).toBe(true)
    expect(useLiveSimStore.getState().timeScale).toBe(0.01)
    expect(useCircuitStore.getState().components.map((c) => c.id)).toContain('D1')
    expect(screen.getByTestId('example-step')).toHaveTextContent(/1\/100 speed/)
    fireEvent.click(screen.getByRole('button', { name: /Next step/ }))
    expect(screen.getByTestId('example-step')).toHaveTextContent(/positive humps/)
    // editing the loaded circuit doesn't touch the library copy
    useCircuitStore.getState().updateComponent('R1', { value: 47 })
    expect(EXAMPLES.find((e) => e.id === 'half-wave-rectifier')!.circuit.components.find((c) => c.id === 'R1')!.value).toBe(1000)
  })
})
