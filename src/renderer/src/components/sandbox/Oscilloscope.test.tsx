import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Oscilloscope from './Oscilloscope'
import { useCircuitStore } from '@stores/circuitStore'

const reset = (): void =>
  useCircuitStore.setState({
    components: [], wires: [], simResult: null,
    selectedComponentId: null, selectedIds: [], selectedWireId: null,
    past: [], future: []
  })

describe('Oscilloscope', () => {
  beforeEach(reset)

  it('prompts for an AC source when there is no AC result', () => {
    render(<Oscilloscope />)
    expect(screen.getByText(/add an ac source/i)).toBeInTheDocument()
  })

  it('lists a trace with peak/RMS/phase for an AC result', () => {
    useCircuitStore.setState({
      simResult: {
        solved: true,
        ac: true,
        omega: 1000,
        nodeVoltages: { n1: 2, gnd: 0 },
        nodeVoltagePhase: { n1: -45, gnd: 0 },
        elementCurrents: {},
        elementCurrentPhase: {},
        terminalNodes: {},
        warnings: []
      }
    })
    render(<Oscilloscope />)
    expect(screen.getByText('n1')).toBeInTheDocument()
    expect(screen.getByText(/Vpk/)).toBeInTheDocument()
    expect(screen.getByText(/∠-45°/)).toBeInTheDocument()
  })
})
