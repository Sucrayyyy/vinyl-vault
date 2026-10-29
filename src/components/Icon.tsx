// Jeu d'icônes Vinyl Vault — dessinées sur une grille 24 px, trait 1,6 px, extrémités arrondies.
import type { SVGProps } from 'react'

const P: Record<string, React.ReactNode> = {
  // Navigation
  collection: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <circle cx="17" cy="17" r="3.6" />
      <circle cx="17" cy="17" r="0.6" fill="currentColor" />
    </>
  ),
  discover: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.2 8.8 13.3 13.3 8.8 15.2 10.7 10.7Z" />
    </>
  ),
  releases: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="2.2" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" />
    </>
  ),
  // Actions
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  down: <path d="m6 9.5 6 6 6-6" />,
  check: <path d="m5 12.5 4.3 4.3L19 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A2 2 0 0 1 6 6.5h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="12.6" r="3.4" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 4.5-4.2 3.5 3.2 3-2.6 5 4.1" />
    </>
  ),
  barcode: <path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12M4 6h0" />,
  scan: (
    <>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h16" />
    </>
  ),
  filter: <path d="M4 6.5h16M7 12h10M10 17.5h4" />,
  sort: <path d="M7 4.5v15M4 16.5l3 3 3-3M17 19.5v-15M14 7.5l3-3 3 3" />,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />,
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.8h-15Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7M10.2 11v5.5M13.8 11v5.5" />,
  edit: <path d="M14.5 5.5 18.5 9.5M4.5 19.5l1-4.3L15.8 4.9a1.6 1.6 0 0 1 2.3 0l1 1a1.6 1.6 0 0 1 0 2.3L8.8 18.5Z" />,
  external: <path d="M13.5 4.5h6v6M19.5 4.5 11 13M10 5.5H6A1.5 1.5 0 0 0 4.5 7v11A1.5 1.5 0 0 0 6 19.5h11a1.5 1.5 0 0 0 1.5-1.5v-4" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2.2" />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" />
    </>
  ),
  tag: (
    <>
      <path d="M4 12.6V5.5A1.5 1.5 0 0 1 5.5 4h7.1l7.4 7.4a1.6 1.6 0 0 1 0 2.2l-6 6a1.6 1.6 0 0 1-2.2 0Z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </>
  ),
  chart: <path d="M4 19.5h16M6.5 15.5l4-4.5 3 2.5 5-6" />,
  spark: <path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5ZM18.5 15.5c.3 1.9.9 2.5 2.8 2.8-1.9.3-2.5.9-2.8 2.8-.3-1.9-.9-2.5-2.8-2.8 1.9-.3 2.5-.9 2.8-2.8Z" />,
  disc: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M7.6 8.2a6 6 0 0 1 2.4-1.8M16.4 15.8a6 6 0 0 1-2.4 1.8" />
    </>
  ),
  layers: <path d="m12 4 8.5 4.5L12 13 3.5 8.5ZM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5" />,
  shield: <path d="M12 3.5 19 6v5.8c0 4.4-3 7.5-7 8.7-4-1.2-7-4.3-7-8.7V6Z" />,
  key: (
    <>
      <circle cx="8" cy="15.5" r="3.8" />
      <path d="m10.8 12.8 8.2-8.3M16 7.5l2.5 2.5M14 9.5l2 2" />
    </>
  ),
  plug: <path d="M9 3.5v5M15 3.5v5M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0ZM12 17v3.5" />,
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9M5 19.5h14" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.2 20.5 19H3.5Z" />
      <path d="M12 10v4M12 16.6v.1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
    </>
  ),
  list: <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6.2 5.5 12 5.5 21.2 12 21.2 12 17.8 18.5 12 18.5 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: <path d="M4 4l16 16M9.9 6A9.8 9.8 0 0 1 12 5.5c5.8 0 9.2 6.5 9.2 6.5a16 16 0 0 1-2.6 3.4M6.3 7.6A16 16 0 0 0 2.8 12s3.4 6.5 9.2 6.5a9 9 0 0 0 4.3-1.1M10 10a2.8 2.8 0 0 0 4 4" />,
  flash: <path d="M13 3.5 5.5 13.5h6l-1 7 7.5-10h-6Z" />,
  wand: <path d="M5 19 15.5 8.5M14 4.5v2M19.5 10h-2M17.9 6.1l-1.4 1.4M12.5 7.5l4 4" />,
}

export type IconName = keyof typeof P

export function Icon({ name, size = 22, weight = 1.6, ...rest }: { name: IconName; size?: number; weight?: number } & Omit<SVGProps<SVGSVGElement>, "stroke">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {P[name]}
    </svg>
  )
}
