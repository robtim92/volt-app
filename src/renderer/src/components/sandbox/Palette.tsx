import { ELEMENTS, type ComponentType } from '../../sim/elements'

interface PaletteProps {
  pendingType: ComponentType | null
  onPick: (type: ComponentType | null) => void
  /** If set, only these component types are shown. */
  allowedTypes?: ComponentType[]
  /** Phone layout: a horizontal, swipeable strip instead of a sidebar. */
  horizontal?: boolean
}

const PALETTE_ICONS: Partial<Record<ComponentType, string>> = {
  resistor: '⏛',
  capacitor: '⊣⊢',
  inductor: '∿',
  voltage_source: '⎓',
  battery: '🔋',
  bench_supply: '⏻',
  current_source: '→',
  ac_voltage_source: '⏦',
  transformer: '⇄',
  diode: '▷|',
  led: '💡',
  switch: '⌁',
  breaker: '⎊',
  gfci: '⊘',
  ground: '⏚',
  wire_node: '•'
}

export default function Palette({ pendingType, onPick, allowedTypes, horizontal = false }: PaletteProps): JSX.Element {
  const entries = Object.values(ELEMENTS).filter(
    (d) => d.inPalette && (!allowedTypes || allowedTypes.includes(d.type))
  )

  if (horizontal) {
    return (
      <div className="shrink-0 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/60" data-testid="palette-strip">
        {pendingType && (
          <p className="px-3 pt-1.5 text-[11px] text-brand-yellow">Tap the board to place it · tap the part again to cancel</p>
        )}
        <div className="flex gap-1.5 overflow-x-auto px-2 py-2">
          {entries.map((def) => {
            const isActive = pendingType === def.type
            return (
              <button
                key={def.type}
                onClick={() => onPick(isActive ? null : def.type)}
                className={`shrink-0 flex flex-col items-center justify-center w-16 h-14 rounded-lg text-[11px] leading-tight border ${
                  isActive
                    ? 'bg-brand-yellow/20 text-brand-yellow border-brand-yellow/60'
                    : 'text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 bg-white dark:bg-white/5'
                }`}
              >
                <span className="font-mono text-base">{PALETTE_ICONS[def.type] ?? '?'}</span>
                <span className="truncate max-w-full px-1">{def.displayName.replace('Voltage Source', 'DC Source').replace('Circuit Breaker', 'Breaker')}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

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
