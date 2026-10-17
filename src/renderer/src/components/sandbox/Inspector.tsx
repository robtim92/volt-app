import { useEffect, useState } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { ELEMENTS, formatValue, parseValue } from '../../sim/elements'
import { terminalKey } from '../../sim/netlist'
import { wireCurrent, wireNetVoltage } from '../../sim/measure'
import PartHealth from './PartHealth'

function Shell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="w-56 shrink-0 border-l border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/60 p-3 overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
        Inspector
      </p>
      {children}
    </div>
  )
}

function Reading({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <p className="flex justify-between text-gray-700 dark:text-gray-300">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </p>
  )
}

/** AC reading: RMS magnitude (from a peak value) with phase, e.g. "3.54 V ∠-45°". */
function acReading(peak: number, phaseDeg: number, unit: string): string {
  return `${formatValue(Math.abs(peak) / Math.SQRT2, unit)} ∠${Math.round(phaseDeg)}°`
}

export default function Inspector(): JSX.Element {
  const selectedId = useCircuitStore((s) => s.selectedComponentId)
  const component = useCircuitStore((s) =>
    s.components.find((c) => c.id === s.selectedComponentId)
  )
  const selectedIds = useCircuitStore((s) => s.selectedIds)
  const selectedWire = useCircuitStore((s) =>
    s.wires.find((w) => w.id === s.selectedWireId)
  )
  const simResult = useCircuitStore((s) => s.simResult)
  const updateComponent = useCircuitStore((s) => s.updateComponent)
  const removeComponent = useCircuitStore((s) => s.removeComponent)
  const removeComponents = useCircuitStore((s) => s.removeComponents)
  const removeWire = useCircuitStore((s) => s.removeWire)
  const toggleSwitch = useCircuitStore((s) => s.toggleSwitch)
  const checkpoint = useCircuitStore((s) => s.checkpoint)

  const [valueText, setValueText] = useState('')
  const [freqText, setFreqText] = useState('')
  const [phaseText, setPhaseText] = useState('')

  const ac = simResult?.ac === true

  // Sync editable fields when selection changes
  useEffect(() => {
    if (component) {
      const def = ELEMENTS[component.type]
      const v = component.value ?? def.defaultValue
      setValueText(v !== null && v !== undefined ? formatValue(v) : '')
      if (component.type === 'ac_voltage_source') {
        setFreqText(String(component.frequency ?? 60))
        setPhaseText(String(component.phase ?? 0))
      }
    }
  }, [selectedId, component?.value, component?.frequency, component?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selected wire (net preview) ──
  if (selectedWire) {
    const netV = simResult?.solved ? wireNetVoltage(selectedWire, simResult) : null
    const netI = simResult?.solved ? wireCurrent(selectedWire, simResult) : null
    const node = simResult?.terminalNodes[terminalKey(selectedWire.fromComponentId, selectedWire.fromTerminal)]
    const netVPhase = node !== undefined ? simResult?.nodeVoltagePhase?.[node] : undefined
    return (
      <Shell>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Wire</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Net connection</p>

        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Measurements {ac && <span className="text-brand-yellow">· AC (RMS)</span>}
        {simResult?.live && <span className="text-emerald-500 normal-case tracking-normal"> · live</span>}
        </p>
        {simResult?.solved ? (
          <div className="text-sm space-y-1">
            <Reading
              label={ac ? 'Net voltage' : 'Net voltage'}
              value={
                netV === null
                  ? '—'
                  : ac
                    ? acReading(netV, netVPhase ?? 0, 'V')
                    : formatValue(netV, 'V')
              }
            />
            <Reading
              label="Current"
              value={
                netI === null
                  ? '—'
                  : ac
                    ? `${formatValue(Math.abs(netI) / Math.SQRT2, 'A')}`
                    : formatValue(Math.abs(netI), 'A')
              }
            />
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {simResult?.error ?? 'No simulation yet'}
          </p>
        )}

        <button
          onClick={() => removeWire(selectedWire.id)}
          className="mt-4 w-full px-2 py-1.5 text-sm rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"
        >
          Delete wire
        </button>
      </Shell>
    )
  }

  // ── Multiple components selected ──
  if (selectedIds.length > 1) {
    return (
      <Shell>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {selectedIds.length} components selected
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Drag any one to move the group.
        </p>
        <button
          onClick={() => removeComponents(selectedIds)}
          className="w-full px-2 py-1.5 text-sm rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"
        >
          Delete selected
        </button>
      </Shell>
    )
  }

  if (!component) {
    return (
      <Shell>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Select a component or wire to edit its properties and see live measurements.
        </p>
      </Shell>
    )
  }

  const def = ELEMENTS[component.type]
  const hasValue = def.defaultValue !== null
  const isAcSource = component.type === 'ac_voltage_source'

  const commitValue = (): void => {
    const parsed = parseValue(valueText)
    if (parsed !== null && parsed > 0) {
      checkpoint()
      updateComponent(component.id, { value: parsed })
    } else if (
      component.type === 'voltage_source' ||
      component.type === 'current_source' ||
      component.type === 'ac_voltage_source'
    ) {
      if (parsed !== null) {
        checkpoint()
        updateComponent(component.id, { value: parsed })
      }
    }
  }

  const commitFreq = (): void => {
    const parsed = parseValue(freqText)
    if (parsed !== null && parsed > 0) {
      checkpoint()
      updateComponent(component.id, { frequency: parsed })
    }
  }

  const commitPhase = (): void => {
    const parsed = parseValue(phaseText)
    if (parsed !== null) {
      checkpoint()
      updateComponent(component.id, { phase: parsed })
    }
  }

  const current = simResult?.elementCurrents[component.id]
  const currentPhase = simResult?.elementCurrentPhase?.[component.id] ?? 0
  const terminalReadings = def.terminals.map((t, i) => {
    const node = simResult?.terminalNodes[terminalKey(component.id, i)]
    const v = node !== undefined ? simResult?.nodeVoltages[node] : undefined
    const ph = node !== undefined ? simResult?.nodeVoltagePhase?.[node] : undefined
    return { index: i, name: t.name, voltage: v, phase: ph }
  })

  return (
    <Shell>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {component.label ?? def.displayName}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{def.displayName}</p>

      {hasValue && (
        <label className="block mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isAcSource
              ? 'Amplitude (V peak)'
              : component.type === 'transformer'
                ? 'Turns ratio (Np:Ns)'
                : component.type === 'breaker'
                  ? 'Trip rating (A)'
                  : component.type === 'gfci'
                    ? 'Leakage trip (A)'
                    : `Value ${def.unit ? `(${def.unit})` : ''}`}
          </span>
          <input
            type="text"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            onBlur={commitValue}
            onKeyDown={(e) => e.key === 'Enter' && commitValue()}
            aria-label="Component value"
            className="mt-1 w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
          />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Suffixes: G M k m µ n p — e.g. “4.7k”
          </span>
        </label>
      )}

      {isAcSource && (
        <div className="flex gap-2 mb-3">
          <label className="block flex-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">Frequency (Hz)</span>
            <input
              type="text"
              value={freqText}
              onChange={(e) => setFreqText(e.target.value)}
              onBlur={commitFreq}
              onKeyDown={(e) => e.key === 'Enter' && commitFreq()}
              aria-label="AC frequency"
              className="mt-1 w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="block w-16">
            <span className="text-xs text-gray-500 dark:text-gray-400">Phase °</span>
            <input
              type="text"
              value={phaseText}
              onChange={(e) => setPhaseText(e.target.value)}
              onBlur={commitPhase}
              onKeyDown={(e) => e.key === 'Enter' && commitPhase()}
              aria-label="AC phase"
              className="mt-1 w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
            />
          </label>
        </div>
      )}

      {(component.type === 'switch' ||
        component.type === 'breaker' ||
        component.type === 'gfci') && (
        <button
          onClick={() => toggleSwitch(component.id)}
          className="mb-3 w-full px-2 py-1.5 text-sm rounded bg-brand-yellow/20 text-brand-yellow hover:bg-brand-yellow/30 font-medium"
        >
          {component.type === 'switch'
            ? component.closed
              ? 'Open switch'
              : 'Close switch'
            : component.closed
              ? 'Turn off'
              : 'Reset (turn on)'}
        </button>
      )}

      {(component.type === 'breaker' || component.type === 'gfci') &&
        simResult?.solved &&
        (component.closed ?? false) &&
        current !== undefined &&
        Math.abs(current) > (component.value ?? Infinity) && (
          <p className="mb-3 text-xs font-semibold text-red-500">
            ⚠ Tripped — {formatValue(Math.abs(current), 'A')} exceeds the{' '}
            {formatValue(component.value ?? 0, 'A')} rating.
          </p>
        )}

      <PartHealth component={component} />

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            checkpoint()
            updateComponent(component.id, { rotation: (component.rotation + 90) % 360 })
          }}
          className="flex-1 px-2 py-1.5 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20"
        >
          Rotate
        </button>
        <button
          onClick={() => removeComponent(component.id)}
          className="flex-1 px-2 py-1.5 text-sm rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"
        >
          Delete
        </button>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
        Measurements {ac && <span className="text-brand-yellow">· AC (RMS)</span>}
        {simResult?.live && <span className="text-emerald-500 normal-case tracking-normal"> · live</span>}
      </p>
      {simResult?.solved ? (
        <div className="text-sm space-y-1">
          {current !== undefined && (
            <Reading
              label="Current"
              value={
                ac ? acReading(current, currentPhase, 'A') : formatValue(Math.abs(current), 'A')
              }
            />
          )}
          {terminalReadings.map((t) => (
            <Reading
              key={t.index}
              label={t.name ?? `Pin ${t.index + 1}`}
              value={
                t.voltage === undefined
                  ? '—'
                  : ac
                    ? acReading(t.voltage, t.phase ?? 0, 'V')
                    : formatValue(t.voltage, 'V')
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {simResult?.error ?? 'No simulation yet'}
        </p>
      )}
    </Shell>
  )
}
