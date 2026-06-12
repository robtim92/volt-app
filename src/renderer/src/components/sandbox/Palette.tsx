import { ELEMENTS, type ComponentType } from '../../sim/elements'

interface PaletteProps {
  pendingType: ComponentType | null
  onPick: (type: ComponentType | null) => void
}

const PALETTE_ICONS: Partial<Record<ComponentType, string>> = {
  resistor: '⏛',
  capacitor: '⊣⊢',
  inductor: '∿',
  voltage_source: '⎓',
  current_source: '→',
  diode: '▷|',
  led: '💡',
  switch: '⌁',
  ground: '⏚',
  wire_node: '•'
}

export default function Palette({ pendingType, onPick }: PaletteProps): JSX.Element {
  const entries = Object.values(ELEMENTS).filter((d) => d.inPalette)

  return (
    <div className="w-44 shrink-0 border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/60 overflow-y-auto">
      <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        Components
      </p>
      <div className="px-2 pb-3 flex flex-col gap-0.5">
        {entries.map((def) => {
          const active = pendingType === def.type
          return (
            <button
              key={def.type}
              onClick={() => onPick(active ? null : def.type)}
              title={`Place ${def.displayName}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                active
                  ? 'bg-brand-yellow/20 text-brand-yellow font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="w-6 text-center text-base leading-none">
                {PALETTE_ICONS[def.type] ?? '·'}
              </span>
              <span className="truncate">{def.displayName}</span>
            </button>
          )
        })}
      </div>
      <p className="px-3 pb-3 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
        Click a component, then click the canvas to place it. Drag between terminals to wire.
        <br />
        <kbd className="font-mono">R</kbd> rotate · <kbd className="font-mono">Del</kbd> remove ·{' '}
        <kbd className="font-mono">Esc</kbd> cancel
      </p>
    </div>
  )
}
