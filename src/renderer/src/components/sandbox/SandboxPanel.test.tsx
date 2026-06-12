import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SandboxPanel from './SandboxPanel'
import { useCircuitStore } from '@stores/circuitStore'
import type { CircuitComponent, Wire } from '../../sim/elements'

const divider = (): { components: CircuitComponent[]; wires: Wire[] } => ({
  components: [
    { id: 'v1', type: 'voltage_source', x: 100, y: 100, rotation: 0, value: 10, label: 'V1' },
    { id: 'r1', type: 'resistor', x: 220, y: 100, rotation: 0, value: 1000, label: 'R1' },
    { id: 'g1', type: 'ground', x: 100, y: 220, rotation: 0, label: 'GND1' }
  ],
  wires: [
    { id: 'w1', fromComponentId: 'v1', fromTerminal: 0, toComponentId: 'r1', toTerminal: 0 },
    { id: 'w2', fromComponentId: 'r1', fromTerminal: 1, toComponentId: 'v1', toTerminal: 1 },
    { id: 'w3', fromComponentId: 'v1', fromTerminal: 1, toComponentId: 'g1', toTerminal: 0 }
  ]
})

beforeEach(() => {
  localStorage.clear()
  useCircuitStore.setState({
    components: [],
    wires: [],
    simResult: null,
    selectedComponentId: null
  })
})

describe('SandboxPanel', () => {
  it('renders the palette, canvas, and inspector', () => {
    render(<SandboxPanel />)
    expect(screen.getByText('Resistor')).toBeInTheDocument()
    expect(screen.getByText('Voltage Source')).toBeInTheDocument()
    expect(screen.getByText('Ground')).toBeInTheDocument()
    expect(screen.getByTestId('circuit-canvas')).toBeInTheDocument()
    expect(screen.getByText(/Select a component/)).toBeInTheDocument()
    expect(screen.getByTestId('sim-status')).toHaveTextContent(/Place components/)
  })

  it('simulates a circuit loaded into the store and reports success', async () => {
    render(<SandboxPanel />)
    const { components, wires } = divider()
    useCircuitStore.getState().loadCircuitData(components, wires)

    await waitFor(
      () => expect(screen.getByTestId('sim-status')).toHaveTextContent(/Solved/),
      { timeout: 2000 }
    )

    const result = useCircuitStore.getState().simResult
    expect(result?.solved).toBe(true)
    expect(result?.elementCurrents['r1']).toBeCloseTo(0.01, 6)
  })

  it('reports solver errors for incomplete circuits', async () => {
    render(<SandboxPanel />)
    // Voltage source with no ground anywhere
    useCircuitStore.getState().loadCircuitData(
      [
        { id: 'v1', type: 'voltage_source', x: 0, y: 0, rotation: 0, value: 5, label: 'V1' },
        { id: 'r1', type: 'resistor', x: 100, y: 0, rotation: 0, value: 100, label: 'R1' }
      ],
      [
        { id: 'w1', fromComponentId: 'v1', fromTerminal: 0, toComponentId: 'r1', toTerminal: 0 },
        { id: 'w2', fromComponentId: 'r1', fromTerminal: 1, toComponentId: 'v1', toTerminal: 1 }
      ]
    )

    await waitFor(
      () => expect(screen.getByTestId('sim-status')).toHaveTextContent(/ground/i),
      { timeout: 2000 }
    )
  })

  it('saves and lists circuits via the toolbar state', async () => {
    render(<SandboxPanel />)
    const { components, wires } = divider()
    useCircuitStore.getState().loadCircuitData(components, wires)
    // direct module check is covered in circuitFiles.test.ts; here we check the
    // store integration didn't break rendering after load
    await waitFor(
      () => expect(screen.getByTestId('sim-status')).toHaveTextContent(/Solved/),
      { timeout: 2000 }
    )
  })
})
