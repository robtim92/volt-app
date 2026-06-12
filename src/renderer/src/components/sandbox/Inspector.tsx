import { useEffect, useState } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { ELEMENTS, formatValue, parseValue } from '../../sim/elements'
import { terminalKey } from '../../sim/netlist'

export default function Inspector(): JSX.Element {
  const selectedId = useCircuitStore((s) => s.selectedComponentId)
  const component = useCircuitStore((s) =>
    s.components.find((c) => c.id === s.selectedComponentId)
  )
  const simResult = useCircuitStore((s) => s.simResult)
  const updateComponent = useCircuitStore((s) => s.updateComponent)
  const removeComponent = useCircuitStore((s) => s.removeComponent)
  const toggleSwitch = useCircuitStore((s) => s.toggleSwitch)

  const [valueText, setValueText] = useState('')

  // Sync the editable value field when selection changes
  useEffect(() => {
    if (component) {
      const def = ELEMENTS[component.type]
      const v = component.value ?? def.defaultValue
      setValueText(v !== null && v !== undefined ? formatValue(v) : '')
    }
  }, [selectedId, component?.value]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!component) {
    return (
      <div className="w-56 shrink-0 border-l border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Inspector
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Select a component to edit its properties and see live measurements.
        </p>
      </div>
    )
  }

  const def = ELEMENTS[component.type]
  const hasValue = def.defaultValue !== null

  const commitValue = (): void => {
    const parsed = parseValue(valueText)
    if (parsed !== null && parsed > 0) {
      updateComponent(component.id, { value: parsed })
    } else if (component.type === 'voltage_source' || component.type === 'current_source') {
      // sources may be zero or negative
      if (parsed !== null) updateComponent(component.id, { value: parsed })
    }
  }

  const current = simResult?.elementCurrents[component.id]
  const terminalVoltages = def.terminals.map((t, i) => {
    const node = simResult?.terminalNodes[terminalKey(component.id, i)]
    const v = node !== undefined ? simResult?.nodeVoltages[node] : undefined
    return { index: i, name: t.name, voltage: v }
  })

  return (
    <div className="w-56 shrink-0 border-l border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/60 p-3 overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
        Inspector
      </p>

      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {component.label ?? def.displayName}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{def.displayName}</p>

      {hasValue && (
        <label className="block mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Value {def.unit && `(${def.unit})`}
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

      {component.type === 'switch' && (
        <button
          onClick={() => toggleSwitch(component.id)}
          className="mb-3 w-full px-2 py-1.5 text-sm rounded bg-brand-yellow/20 text-brand-yellow hover:bg-brand-yellow/30 font-medium"
        >
          {component.closed ? 'Open switch' : 'Close switch'}
        </button>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() =>
            updateComponent(component.id, { rotation: (component.rotation + 90) % 360 })
          }
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
        Measurements
      </p>
      {simResult?.solved ? (
        <div className="text-sm space-y-1">
          {current !== undefined && (
            <p className="flex justify-between text-gray-700 dark:text-gray-300">
              <span>Current</span>
              <span className="font-mono">{formatValue(Math.abs(current), 'A')}</span>
            </p>
          )}
          {terminalVoltages.map((t) => (
            <p
              key={t.index}
              className="flex justify-between text-gray-700 dark:text-gray-300"
            >
              <span>{t.name ?? `Pin ${t.index + 1}`}</span>
              <span className="font-mono">
                {t.voltage !== undefined ? formatValue(t.voltage, 'V') : '—'}
              </span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {simResult?.error ?? 'No simulation yet'}
        </p>
      )}
    </div>
  )
}
