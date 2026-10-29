/** Logo Vinyl Vault : disque chromé, étiquette Signal, serrure (le « coffre »). */
export function LogoMark({ size = 28, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={spin ? 'logo-spin' : ''} aria-hidden="true">
      <defs>
        <linearGradient id="lm-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f4f2" />
          <stop offset="0.5" stopColor="#7d7d82" />
          <stop offset="1" stopColor="#e2e2df" />
        </linearGradient>
        <linearGradient id="lm-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#111113" stroke="url(#lm-rim)" strokeWidth="1.5" />
      <g fill="none" stroke="#fff" strokeOpacity="0.09" strokeWidth="0.8">
        <circle cx="32" cy="32" r="25" />
        <circle cx="32" cy="32" r="21" />
        <circle cx="32" cy="32" r="17" />
      </g>
      <circle cx="32" cy="32" r="30" fill="url(#lm-sheen)" />
      <circle cx="32" cy="32" r="11" fill="var(--accent)" />
      <path d="M32 26.4a2.7 2.7 0 0 1 1.4 5l1.1 5.8h-5l1.1-5.8a2.7 2.7 0 0 1 1.4-5z" fill="#0a0a0b" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark size={22} />
      <span className="wordmark-text">
        Vinyl<em>Vault</em>
      </span>
    </span>
  )
}
