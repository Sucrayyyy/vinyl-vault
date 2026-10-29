import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { ValueChart } from '../../components/Chart'
import { CoverArt } from '../../components/CoverArt'
import { Icon } from '../../components/Icon'
import { AnimatedNumber, Badge, Button, Segmented, Sheet, softSpring } from '../../components/ui'
import { useEstimates, useMoney } from '../../lib/hooks'
import { useApp } from '../../lib/store'
import { BASIS_LABEL, collectionHistory, periodChange, summarize, type Basis } from '../../lib/valuation'
import { pct } from '../../lib/util'
import { describeError } from '../../services/http'
import { refreshRecordPrices } from '../../services/market'

type Period = '1M' | '3M' | '1A' | 'TOUT'
const PERIOD_MS: Record<Period, number> = { '1M': 30, '3M': 91, '1A': 365, TOUT: 0 }

export function ValueCard() {
  const records = useApp((s) => s.records)
  const prices = useApp((s) => s.prices)
  const fmt = useMoney()
  const [period, setPeriod] = useState<Period>('1A')
  const [open, setOpen] = useState(false)

  const sum = useMemo(() => summarize(records, prices), [records, prices])
  const history = useMemo(() => {
    const since = PERIOD_MS[period] ? Date.now() - PERIOD_MS[period] * 86400000 : 0
    return collectionHistory(records, prices, since)
  }, [records, prices, period])

  const delta = sum.purchaseCovered && sum.covered ? sum.total - sum.purchaseTotal : undefined
  const change = useMemo(() => {
    const since = PERIOD_MS[period] ? Date.now() - PERIOD_MS[period] * 86400000 : history[0]?.at
    return since ? periodChange(records, prices, since) : undefined
  }, [records, prices, period, history])

  return (
    <>
      <motion.div role="button" tabIndex={0} className="value-card" onClick={() => setOpen(true)} onKeyDown={(e) => e.key === 'Enter' && setOpen(true)} whileTap={{ scale: 0.985 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
        <div className="value-card-top">
          <div>
            <div className="kicker">Valeur estimée {sum.demo && <Badge tone="demo">fictive</Badge>}</div>
            <div className="value-big">{sum.covered ? <AnimatedNumber value={sum.total} format={(n) => fmt(n)} /> : '—'}</div>
            <div className="value-sub mono">
              {delta != null ? (
                <span className={delta >= 0 ? 'up' : 'down'}>
                  {delta >= 0 ? '+' : '−'}
                  {fmt(Math.abs(delta))} depuis l’achat
                </span>
              ) : (
                `${sum.covered}/${records.length} disques estimés`
              )}
              {change && (
                <span className={change.pct >= 0 ? 'up' : 'down'}>
                  {' '}
                  · {pct(change.pct)} ({period === 'TOUT' ? 'total' : period})
                </span>
              )}
            </div>
          </div>
          <Icon name="chevron" size={18} className="value-card-chev" />
        </div>
        {history.length >= 2 ? (
          <MiniSpark values={history.map((h) => h.value)} />
        ) : (
          !sum.covered && <p className="value-note">Les prix apparaissent pour les disques identifiés via Discogs.</p>
        )}
      </motion.div>
      <ValueSheet open={open} onClose={() => setOpen(false)} period={period} setPeriod={setPeriod} />
    </>
  )
}

function MiniSpark({ values }: { values: number[] }) {
  const W = 300
  const H = 46
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * W).toFixed(1)},${(H - 4 - ((v - min) / span) * (H - 8)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini-spark" preserveAspectRatio="none" aria-hidden>
      <motion.path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
    </svg>
  )
}

function ValueSheet({ open, onClose, period, setPeriod }: { open: boolean; onClose: () => void; period: Period; setPeriod: (p: Period) => void }) {
  const records = useApp((s) => s.records)
  const prices = useApp((s) => s.prices)
  const openRecord = useApp((s) => s.openRecord)
  const toast = useApp((s) => s.toast)
  const est = useEstimates()
  const fmt = useMoney()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const sum = useMemo(() => summarize(records, prices), [records, prices])
  const history = useMemo(() => {
    const since = PERIOD_MS[period] ? Date.now() - PERIOD_MS[period] * 86400000 : 0
    return collectionHistory(records, prices, since)
  }, [records, prices, period])
  const top = useMemo(
    () => records.filter((r) => est.get(r.id)?.value != null).sort((a, b) => (est.get(b.id)!.value ?? 0) - (est.get(a.id)!.value ?? 0)).slice(0, 5),
    [records, est],
  )
  const linkable = records.filter((r) => r.discogsId && !r.demo)

  const refreshAll = async () => {
    setProgress({ done: 0, total: linkable.length })
    let added = 0
    let errors = 0
    for (let i = 0; i < linkable.length; i++) {
      try {
        added += (await refreshRecordPrices(linkable[i])).added
      } catch (e) {
        errors++
        if (errors === 1) toast(describeError(e), 'error')
        if (errors >= 3) break
      }
      setProgress({ done: i + 1, total: linkable.length })
    }
    setProgress(null)
    toast(`${added} nouvelle${added > 1 ? 's' : ''} observation${added > 1 ? 's' : ''} de prix`)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Valeur de la collection" full>
      <div className="form-stack">
        {sum.demo && (
          <div className="note note-demo">
            <Icon name="info" size={16} />
            Les prix des disques de démonstration sont fictifs.
          </div>
        )}
        <Segmented value={period} onChange={setPeriod} options={(['1M', '3M', '1A', 'TOUT'] as Period[]).map((p) => ({ value: p, label: p === 'TOUT' ? 'Tout' : p }))} />
        {history.length >= 2 ? (
          <ValueChart points={history.map((h) => ({ at: h.at, value: h.value, label: `${h.covered} disque${h.covered > 1 ? 's' : ''} estimé${h.covered > 1 ? 's' : ''}` }))} format={(n) => fmt(n)} height={190} />
        ) : (
          <div className="note">
            <Icon name="chart" size={16} />
            Pas encore assez d’observations sur cette période pour tracer une évolution ({history.length} point{history.length > 1 ? 's' : ''}).
          </div>
        )}

        <div className="stat-grid">
          <div className="stat">
            <span className="kicker">Valeur estimée</span>
            <span className="stat-value">{sum.covered ? fmt(sum.total) : '—'}</span>
            <span className="stat-foot mono">{sum.covered} disques couverts</span>
          </div>
          <div className="stat">
            <span className="kicker">Prix d’achat total</span>
            <span className="stat-value">{sum.purchaseCovered ? fmt(sum.purchaseTotal) : '—'}</span>
            <span className="stat-foot mono">{sum.purchaseCovered} prix renseignés</span>
          </div>
        </div>

        <div className="form-group">
          <div className="form-label">Fiabilité des estimations</div>
          <div className="basis-list">
            {(['sold', 'suggested', 'manual', 'asking-low', 'none'] as Basis[]).map((b) => (
              <div key={b} className="basis-row">
                <span className={`basis-dot basis-${b}`} />
                <span>{BASIS_LABEL[b]}</span>
                <span className="mono">{sum.byBasis[b]}</span>
              </div>
            ))}
          </div>
          <p className="fine">
            Ordre de priorité : médiane des ventes réelles (12 derniers mois, même état si possible), puis suggestion par état, puis votre estimation, puis le prix
            affiché le plus bas (indicatif — un prix demandé n’est pas un prix de vente).
          </p>
        </div>

        {top.length > 0 && (
          <div className="form-group">
            <div className="form-label">Disques les plus valorisés</div>
            <div className="mini-list">
              {top.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="mini-row"
                  onClick={() => {
                    onClose()
                    setTimeout(() => openRecord(r.id), 250)
                  }}
                >
                  <CoverArt src={r} className="mini-cover" />
                  <span className="mini-text">
                    <span className="record-title">{r.title}</span>
                    <span className="record-artist">{r.artist}</span>
                  </span>
                  <span className="mono">{fmt(est.get(r.id)?.value)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Button variant="accent" icon="refresh" onClick={refreshAll} busy={!!progress} disabled={!linkable.length}>
          {progress ? `Actualisation ${progress.done}/${progress.total}` : `Actualiser les prix (${linkable.length} disque${linkable.length > 1 ? 's' : ''} liés à Discogs)`}
        </Button>
      </div>
    </Sheet>
  )
}
