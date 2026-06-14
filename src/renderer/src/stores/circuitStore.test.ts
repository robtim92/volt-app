import { describe, it, expect, beforeEach } from 'vitest'
import { useCircuitStore } from './circuitStore'
import type { CircuitComponent, Wire } from '../sim/elements'

const comp = (id: string, over: Partial<CircuitComponent> = {}): CircuitComponent => ({
  id,
  type: 'resistor',
  x: 0,
  y: 0,
  rotation: 0,
  value: 1000,
  ...over
})

const reset = (): void =>
  useCircuitStore.setState({
    components: [],
    wires: [],
    simResult: null,
    selectedComponentId: null,
    selectedIds: [],
    selectedWireId: null,
    past: [],
    future: []
  })

describe('circuitStore — undo/redo', () => {
  beforeEach(reset)

  it('undoes and redoes a component placement', () => {
    const s = useCircuitStore.getState()
    s.addComponent(comp('R1'))
    expect(useCircuitStore.getState().components).toHaveLength(1)

    useCircuitStore.getState().undo()
    expect(useCircuitStore.getState().components).toHaveLength(0)

    useCircuitStore.getState().redo()
    expect(useCircuitStore.getState().components).toHaveLength(1)
    expect(useCircuitStore.getState().components[0].id).toBe('R1')
  })

  it('treats a checkpoint + move as one undoable step', () => {
    const s = useCircuitStore.getState()
    s.addComponent(comp('R1', { x: 0 }))
    // simulate a drag: checkpoint once, then several position updates
    useCircuitStore.getState().checkpoint()
    useCircuitStore.getState().updateComponent('R1', { x: 20 })
    useCircuitStore.getState().updateComponent('R1', { x: 40 })
    expect(useCircuitStore.getState().components[0].x).toBe(40)

    useCircuitStore.getState().undo()
    expect(useCircuitStore.getState().components[0].x).toBe(0)
  })

  it('clears the redo stack when a new edit happens after an undo', () => {
    const s = useCircuitStore.getState()
    s.addComponent(comp('R1'))
    useCircuitStore.getState().undo()
    expect(useCircuitStore.getState().future).toHaveLength(1)
    useCircuitStore.getState().addComponent(comp('R2'))
    expect(useCircuitStore.getState().future).toHaveLength(0)
  })

  it('is a no-op when there is nothing to undo/redo', () => {
    useCircuitStore.getState().undo()
    useCircuitStore.getState().redo()
    expect(useCircuitStore.getState().components).toHaveLength(0)
  })
})

describe('circuitStore — selection', () => {
  beforeEach(reset)

  it('single-select sets both primary id and selectedIds', () => {
    useCircuitStore.getState().selectComponent('R1')
    expect(useCircuitStore.getState().selectedComponentId).toBe('R1')
    expect(useCircuitStore.getState().selectedIds).toEqual(['R1'])
  })

  it('multi-select leaves no single primary', () => {
    useCircuitStore.getState().setSelection(['R1', 'R2'])
    expect(useCircuitStore.getState().selectedIds).toEqual(['R1', 'R2'])
    expect(useCircuitStore.getState().selectedComponentId).toBeNull()
  })

  it('selecting a wire clears component selection', () => {
    useCircuitStore.getState().selectComponent('R1')
    useCircuitStore.getState().selectWire('w1')
    const st = useCircuitStore.getState()
    expect(st.selectedWireId).toBe('w1')
    expect(st.selectedComponentId).toBeNull()
    expect(st.selectedIds).toEqual([])
  })

  it('undo clears any active selection', () => {
    useCircuitStore.getState().addComponent(comp('R1'))
    useCircuitStore.getState().selectComponent('R1')
    useCircuitStore.getState().undo()
    expect(useCircuitStore.getState().selectedComponentId).toBeNull()
  })
})

describe('circuitStore — removeComponents', () => {
  beforeEach(reset)

  it('removes several components and any wires touching them', () => {
    const wire: Wire = {
      id: 'w1', fromComponentId: 'R1', fromTerminal: 1, toComponentId: 'R2', toTerminal: 0
    }
    useCircuitStore.setState({ components: [comp('R1'), comp('R2'), comp('R3')], wires: [wire] })
    useCircuitStore.getState().removeComponents(['R1', 'R2'])
    const st = useCircuitStore.getState()
    expect(st.components.map((c) => c.id)).toEqual(['R3'])
    expect(st.wires).toHaveLength(0)
    expect(st.selectedIds).toEqual([])
  })

  it('can be undone', () => {
    useCircuitStore.setState({ components: [comp('R1'), comp('R2')] })
    useCircuitStore.getState().removeComponents(['R1', 'R2'])
    expect(useCircuitStore.getState().components).toHaveLength(0)
    useCircuitStore.getState().undo()
    expect(useCircuitStore.getState().components).toHaveLength(2)
  })
})
