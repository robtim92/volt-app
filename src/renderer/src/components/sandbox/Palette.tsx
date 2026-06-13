import { ELEMENTS, type ComponentType } from '../../sim/elements'

interface PaletteProps {
  pendingType: ComponentType | null
  onPick: (type: ComponentType | null) => void
  /** If set, only these component types are shown. */
  allowedTypes?: ComponentType[]
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

export default function Palette({ pendingType, onPick, allowedTypes }: PaletteProps): JSX.Element {
  const entries = Object.values(ELEMENTS).filter(
    (d) => d.inPalette && (!allowedTypes || allowedTypes.includes(d.type))
  )

  return (
    <div className="w-44 shrink-0 border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/60 overflow-y-auto">
      <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        Components
      </p>
      <div className="px-2 pb-3 flex flex-col gap-0.5">
        {entries.map((def) => {
          const isActive = pendingType === def.type
          return (
            <button
              key={def.type}
              onClick={() => onPick(isActive ? null : def.type)}
              title={def.displayName}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-sm transition-colors ${
                isActive
                  ? 'bg-brand-yellow/20 text-brand-yellow'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
            >
              <span className="font-mono text-base w-5 text-center shrink-0">
                {PALETTE_ICONS[def.type] ?? '?'}
              </span>
              <span className="truncate">{def.displayName}</span>
            </button>
          )
        })}
      </div>
      {pendingType && (
        <p className="px-3 pb-3 text-xs text-brand-yellow/80">
          Click canvas to place. Press Escape or click active item to cancel.
        </p>
      )}
    </div>
  )
}
