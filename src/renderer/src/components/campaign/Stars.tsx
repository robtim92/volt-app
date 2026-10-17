/** Three-star row. `size` in px. */
export default function Stars({ count, size = 14, animate = false }: { count: number; size?: number; animate?: boolean }): JSX.Element {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={animate && i < count ? 'animate-star-pop' : ''}
          style={animate ? { animationDelay: `${0.25 + i * 0.3}s` } : undefined}
        >
          <path
            d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
            fill={i < count ? '#E8B500' : 'none'}
            stroke={i < count ? '#E8B500' : 'currentColor'}
            strokeWidth="1.5"
            strokeLinejoin="round"
            opacity={i < count ? 1 : 0.35}
          />
        </svg>
      ))}
    </span>
  )
}
