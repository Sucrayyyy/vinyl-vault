import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store'
import { haptic } from '../lib/util'
import { Icon, type IconName } from './Icon'

export const spring = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const

/* ── Boutons ─────────────────────────────────────────── */
export function Button({
  children,
  icon,
  variant = 'solid',
  size = 'md',
  onClick,
  disabled,
  type = 'button',
  className = '',
  busy,
  ariaLabel,
}: {
  children?: ReactNode
  icon?: IconName
  variant?: 'solid' | 'accent' | 'ghost' | 'glass' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  busy?: boolean
  ariaLabel?: string
}) {
  return (
    <motion.button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={spring}
      onClick={() => {
        haptic()
        onClick?.()
      }}
      disabled={disabled || busy}
      aria-label={ariaLabel}
      aria-busy={busy}
    >
      {busy ? <span className="spinner" aria-hidden /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} />}
      {children && <span>{children}</span>}
    </motion.button>
  )
}

export function IconButton({ icon, label, onClick, variant = 'glass', active, size = 40, badge }: { icon: IconName; label: string; onClick: () => void; variant?: 'glass' | 'plain' | 'accent'; active?: boolean; size?: number; badge?: number }) {
  return (
    <motion.button
      type="button"
      className={`icon-btn icon-btn-${variant} ${active ? 'is-active' : ''}`}
      style={{ width: size, height: size }}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      onClick={() => {
        haptic()
        onClick()
      }}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
      {!!badge && <span className="icon-badge">{badge > 9 ? '9+' : badge}</span>}
    </motion.button>
  )
}

/* ── Chips & segments ────────────────────────────────── */
export function Chip({ children, active, onClick, icon }: { children: ReactNode; active?: boolean; onClick?: () => void; icon?: IconName }) {
  return (
    <motion.button type="button" className={`chip ${active ? 'is-active' : ''}`} onClick={onClick} whileTap={{ scale: 0.94 }} transition={spring} aria-pressed={active}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </motion.button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  const id = useId()
  return (
    <div className={`segmented segmented-${size}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="segmented-pill" transition={spring} />}
          <span className="segmented-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => { haptic(); onChange(!checked) }}>
      <motion.span className="toggle-knob" layout transition={spring} />
    </button>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'demo' | 'warn' | 'up' | 'down' | 'info' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export const DemoBadge = () => <Badge tone="demo">Démo · fictif</Badge>

export function Skeleton({ w = '100%', h = 14, r = 6, className = '' }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: r }} />
}

export function Empty({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </motion.div>
  )
}

export function SectionHeader({ kicker, title, action }: { kicker?: string; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

/* ── Feuille modale (bottom sheet) ───────────────────── */
export function Sheet({
  open,
  onClose,
  children,
  title,
  full = false,
  headerRight,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  full?: boolean
  headerRight?: ReactNode
}) {
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('has-sheet')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('has-sheet')
    }
  }, [open, onClose])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-root" role="dialog" aria-modal="true">
          <motion.div className="sheet-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <motion.div
            className={`sheet ${full ? 'sheet-full' : ''}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className="sheet-head" onPointerDown={(e) => controls.start(e)}>
              <span className="sheet-grabber" />
              <div className="sheet-title-row">
                <div className="sheet-title">{title}</div>
                <div className="sheet-actions">
                  {headerRight}
                  <IconButton icon="close" label="Fermer" onClick={onClose} size={34} />
                </div>
              </div>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ── Notifications éphémères ─────────────────────────── */
export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  return createPortal(
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast-${t.tone}`}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={spring}
            onClick={() => dismiss(t.id)}
          >
            <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'warn' ? 'info' : 'check'} size={17} />
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={(e) => {
                  e.stopPropagation()
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

/* ── Champs ──────────────────────────────────────────── */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** Nombre animé (compteur) — respecte la réduction des animations via CSS/MotionConfig. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const reduce = document.documentElement.dataset.motion === 'reduced'
    if (reduce) {
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    const d = 900
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / d)
      const e = 1 - Math.pow(1 - k, 4)
      setShown(a + (value - a) * e)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(shown)}</>
}

export function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`ext-link ${className}`}>
      {children}
      <Icon name="external" size={14} />
    </a>
  )
}
