import { motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bars } from '../../components/Chart'
import { Icon, type IconName } from '../../components/Icon'
import { LogoMark } from '../../components/Logo'
import { Badge, Button, Chip, Field, Segmented, Sheet, Toggle } from '../../components/ui'
import { requestPersistence } from '../../lib/db'
import { useEstimates, useMoney } from '../../lib/hooks'
import { downloadJson } from '../../lib/ics'
import { isStandalone, notificationsSupported, requestNotifications } from '../../lib/notify'
import { exportData, useApp } from '../../lib/store'
import type { Follow, PersistedState } from '../../lib/types'
import { CONNECTORS, type ConnectorStatus } from '../../services/market'
import { currentSession, pullVault, pushVault, sendMagicLink, signOut, syncConfigured } from '../../services/sync'

const GENRE_SUGGESTIONS = ['Jazz', 'Soul', 'Funk', 'Rock', 'Pop', 'Electronic', 'House', 'Techno', 'Hip Hop', 'Ambient', 'Folk', 'Classical', 'Reggae', 'Disco', 'Post-Punk', 'Shoegaze', 'City Pop', 'Chanson', 'Krautrock', 'Blues']

export function ProfileScreen() {
  const profile = useApp((s) => s.profile)
  const setProfile = useApp((s) => s.setProfile)
  const records = useApp((s) => s.records)
  const [sheet, setSheet] = useState<null | 'connectors' | 'data' | 'install' | 'account'>(null)

  return (
    <div className="screen">
      <div className="profile-head">
        <motion.div className="profile-avatar" initial={{ rotate: -90, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 18 }}>
          <LogoMark size={64} spin />
        </motion.div>
        <input
          className="profile-name display"
          value={profile.displayName}
          placeholder="Votre nom"
          onChange={(e) => setProfile({ displayName: e.target.value })}
          aria-label="Nom affiché"
        />
        <span className="hero-count mono">
          {(() => {
            const n = records.filter((r) => !r.demo).length
            return `${n} disque${n > 1 ? 's' : ''} personnel${n > 1 ? 's' : ''} · ${profile.follows.length} suivi${profile.follows.length > 1 ? 's' : ''}`
          })()}
        </span>
      </div>

      <Stats />

      <Group title="Goûts musicaux" icon="spark">
        <div className="form-group">
          <div className="form-label">Genres préférés</div>
          <div className="chip-wrap">
            {[...new Set([...GENRE_SUGGESTIONS, ...profile.genres])].map((g) => (
              <Chip key={g} active={profile.genres.includes(g)} onClick={() => setProfile({ genres: profile.genres.includes(g) ? profile.genres.filter((x) => x !== g) : [...profile.genres, g] })}>
                {g}
              </Chip>
            ))}
          </div>
        </div>
        <TagEditor label="Artistes favoris" placeholder="Ajouter un artiste" values={profile.favoriteArtists} onChange={(v) => setProfile({ favoriteArtists: v })} />
        <TagEditor
          label="Labels suivis"
          placeholder="Ex. Blue Note, Warp…"
          values={profile.follows.filter((f) => f.kind === 'label').map((f) => f.name)}
          onChange={(v) => setProfile({ follows: [...profile.follows.filter((f) => f.kind !== 'label'), ...v.map<Follow>((name) => ({ kind: 'label', name }))] })}
        />
        <TagEditor
          label="Artistes suivis (sorties)"
          placeholder="Ajouter un artiste à suivre"
          values={profile.follows.filter((f) => f.kind === 'artist').map((f) => f.name)}
          onChange={(v) => setProfile({ follows: [...profile.follows.filter((f) => f.kind !== 'artist'), ...v.map<Follow>((name) => ({ kind: 'artist', name }))] })}
        />
        <p className="fine">Ces préférences alimentent l’onglet Découvrir et le fil des Sorties.</p>
      </Group>

      <Notifications />
      <Privacy />

      <Group title="Réglages" icon="layers">
        <Row icon="plug" label="Connecteurs & reconnaissance" onClick={() => setSheet('connectors')} />
        <Row icon="user" label="Compte & synchronisation" onClick={() => setSheet('account')} value={syncConfigured() ? (currentSession() ? 'Connecté' : 'Non connecté') : 'Local'} />
        <Row icon="download" label="Données & sauvegarde" onClick={() => setSheet('data')} />
        <Row icon="disc" label="Installer sur l’iPhone" onClick={() => setSheet('install')} value={isStandalone() ? 'Installée' : undefined} />
        <MotionPref />
      </Group>

      <p className="fine center about">
        Vinyl Vault 1.0 · Données musicales : Discogs, MusicBrainz, Apple iTunes, Cover Art Archive.
        <br />
        Vos données restent sur cet appareil.
      </p>

      <ConnectorsSheet open={sheet === 'connectors'} onClose={() => setSheet(null)} />
      <DataSheet open={sheet === 'data'} onClose={() => setSheet(null)} />
      <InstallSheet open={sheet === 'install'} onClose={() => setSheet(null)} />
      <AccountSheet open={sheet === 'account'} onClose={() => setSheet(null)} />
    </div>
  )
}

function Group({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return (
    <motion.section className="group" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
      <h2 className="group-title">
        <Icon name={icon} size={16} /> {title}
      </h2>
      <div className="group-body">{children}</div>
    </motion.section>
  )
}

function Row({ icon, label, value, onClick, children }: { icon: IconName; label: string; value?: string; onClick?: () => void; children?: ReactNode }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp type={onClick ? 'button' : undefined} className="row" onClick={onClick}>
      <span className="row-icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="row-label">{label}</span>
      {value && <span className="row-value">{value}</span>}
      {children}
      {onClick && <Icon name="chevron" size={16} className="muted" />}
    </Comp>
  )
}

function TagEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [text, setText] = useState('')
  const add = () => {
    const v = text.trim()
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v])
    setText('')
  }
  return (
    <div className="form-group">
      <div className="form-label">{label}</div>
      <div className="chip-wrap">
        {values.map((v) => (
          <Chip key={v} active onClick={() => onChange(values.filter((x) => x !== v))}>
            {v} <Icon name="close" size={12} />
          </Chip>
        ))}
      </div>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} enterKeyHint="done" />
        <Button type="submit" size="sm" variant="glass" icon="plus" ariaLabel={`Ajouter — ${label}`} />
      </form>
    </div>
  )
}

function Stats() {
  const records = useApp((s) => s.records)
  const est = useEstimates()
  const fmt = useMoney()
  const s = useMemo(() => {
    const count = (f: (r: (typeof records)[number]) => string[] | string | undefined) => {
      const m = new Map<string, number>()
      records.forEach((r) => {
        const v = f(r)
        ;(Array.isArray(v) ? v : v ? [v] : []).forEach((k) => m.set(k, (m.get(k) ?? 0) + 1))
      })
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
    }
    const total = [...est.values()].reduce((a, e) => a + (e.value ?? 0), 0)
    return {
      genres: count((r) => r.genres).slice(0, 5),
      decades: count((r) => (r.year ? `${Math.floor(r.year / 10) * 10}s` : undefined)).sort((a, b) => a.label.localeCompare(b.label)),
      labels: count((r) => r.label).slice(0, 4),
      originals: records.filter((r) => r.pressing === 'original').length,
      colored: records.filter((r) => r.color).length,
      total,
      avg: records.length ? total / Math.max(1, [...est.values()].filter((e) => e.value != null).length) : 0,
    }
  }, [records, est])

  if (!records.length) return null
  return (
    <Group title="Statistiques de collection" icon="chart">
      <div className="stat-grid three">
        <div className="stat">
          <span className="kicker">Disques</span>
          <span className="stat-value">{records.length}</span>
        </div>
        <div className="stat">
          <span className="kicker">Originaux</span>
          <span className="stat-value">{Math.round((s.originals / records.length) * 100)} %</span>
        </div>
        <div className="stat">
          <span className="kicker">Valeur moy.</span>
          <span className="stat-value">{fmt(s.avg)}</span>
        </div>
      </div>
      {s.genres.length > 0 && (
        <div className="form-group">
          <div className="form-label">Genres</div>
          <Bars data={s.genres} />
        </div>
      )}
      {s.decades.length > 0 && (
        <div className="form-group">
          <div className="form-label">Décennies</div>
          <Bars data={s.decades} />
        </div>
      )}
      {s.labels.length > 0 && (
        <div className="form-group">
          <div className="form-label">Labels les plus présents</div>
          <Bars data={s.labels} />
        </div>
      )}
      {records.some((r) => r.demo) && <p className="fine">Inclut la collection de démonstration (fictive).</p>}
    </Group>
  )
}

function Notifications() {
  const profile = useApp((s) => s.profile)
  const setProfile = useApp((s) => s.setProfile)
  const toast = useApp((s) => s.toast)
  const n = profile.notifications
  const set = (patch: Partial<typeof n>) => setProfile({ notifications: { ...n, ...patch } })
  const enableSystem = async (v: boolean) => {
    if (!v) return set({ systemNotifications: false })
    if (!notificationsSupported() || (!isStandalone() && /iPhone|iPad/.test(navigator.userAgent))) {
      toast('Sur iPhone, installez d’abord l’app sur l’écran d’accueil (iOS 16.4+).', 'warn')
      return
    }
    const p = await requestNotifications()
    if (p === 'granted') set({ systemNotifications: true })
    else toast('Notifications refusées. Modifiez-les dans Réglages › Notifications.', 'warn')
  }
  return (
    <Group title="Notifications" icon="bell">
      <Row icon="tag" label="Prix cible atteint">
        <Toggle checked={n.priceDrops} onChange={(v) => set({ priceDrops: v })} label="Prix cible atteint" />
      </Row>
      <Row icon="calendar" label="Sorties suivies">
        <Toggle checked={n.releases} onChange={(v) => set({ releases: v })} label="Sorties suivies" />
      </Row>
      <Row icon="bell" label="Notifications de l’appareil">
        <Toggle checked={n.systemNotifications} onChange={enableSystem} label="Notifications de l’appareil" />
      </Row>
      <p className="fine">Les vérifications ont lieu à l’ouverture de l’app (au plus toutes les 6 h). Pour des rappels fiables sans ouvrir l’app, utilisez « Rappel » (calendrier) sur une sortie.</p>
    </Group>
  )
}

function Privacy() {
  const profile = useApp((s) => s.profile)
  const setProfile = useApp((s) => s.setProfile)
  const p = profile.privacy
  const set = (patch: Partial<typeof p>) => setProfile({ privacy: { ...p, ...patch } })
  return (
    <Group title="Confidentialité" icon="shield">
      <Row icon={p.hideValues ? 'eyeOff' : 'eye'} label="Masquer les montants">
        <Toggle checked={p.hideValues} onChange={(v) => set({ hideValues: v })} label="Masquer les montants" />
      </Row>
      <Row icon="spark" label="Envoyer les photos à la reconnaissance">
        <Toggle checked={p.sendPhotosToVision} onChange={(v) => set({ sendPhotosToVision: v })} label="Envoyer les photos à la reconnaissance" />
      </Row>
      <Row icon="tag" label="Rechercher les prix en ligne">
        <Toggle checked={p.priceLookups} onChange={(v) => set({ priceLookups: v })} label="Rechercher les prix en ligne" />
      </Row>
      <p className="fine">Aucune donnée n’est envoyée à un serveur Vinyl Vault. Les recherches interrogent directement Discogs, MusicBrainz et Apple ; la reconnaissance visuelle, uniquement l’API Anthropic avec votre clé.</p>
    </Group>
  )
}

function MotionPref() {
  const motionPref = useApp((s) => s.settings.motion)
  const setSettings = useApp((s) => s.setSettings)
  return (
    <div className="row">
      <span className="row-icon">
        <Icon name="wand" size={17} />
      </span>
      <span className="row-label">Animations</span>
      <Segmented
        size="sm"
        value={motionPref}
        onChange={(v) => setSettings({ motion: v })}
        options={[
          { value: 'system', label: 'Auto' },
          { value: 'reduced', label: 'Réduites' },
          { value: 'full', label: 'Complètes' },
        ]}
      />
    </div>
  )
}

const STATUS_TEXT: Record<ConnectorStatus, { label: string; tone: 'up' | 'warn' | 'neutral' | 'info' }> = {
  active: { label: 'Actif', tone: 'up' },
  token: { label: 'Actif · jeton optionnel', tone: 'info' },
  backend: { label: 'Backend requis', tone: 'warn' },
  links: { label: 'Liens uniquement', tone: 'neutral' },
}

function ConnectorsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const toast = useApp((s) => s.toast)
  const [discogs, setDiscogs] = useState('')
  const [anthropic, setAnthropic] = useState('')
  useEffect(() => {
    if (open) {
      setDiscogs(settings.discogsToken ?? '')
      setAnthropic(settings.anthropicKey ?? '')
    }
  }, [open, settings.discogsToken, settings.anthropicKey])

  return (
    <Sheet open={open} onClose={onClose} title="Connecteurs" full>
      <div className="form-stack">
        <div className="note">
          <Icon name="lock" size={16} />
          Les clés saisies ici restent sur cet iPhone (stockage local). Elles ne sont jamais incluses dans les exports ni dans le code publié.
        </div>

        <div className="form-label section-label">Reconnaissance de pochette</div>
        <Segmented
          value={settings.recognition}
          onChange={(v) => setSettings({ recognition: v })}
          options={[
            { value: 'auto', label: 'Automatique' },
            { value: 'vision', label: 'Vision' },
            { value: 'ocr', label: 'Texte (OCR)' },
          ]}
        />
        <Field label="Clé API Anthropic (Claude Vision)" hint="Facultatif. Identifie les pochettes sans texte. Créez une clé sur console.anthropic.com ; chaque analyse est facturée sur votre compte.">
          <input type="password" autoComplete="off" value={anthropic} onChange={(e) => setAnthropic(e.target.value)} placeholder="sk-ant-…" className="mono" />
        </Field>

        <div className="form-label section-label">Discogs</div>
        <Field label="Jeton personnel Discogs" hint="Facultatif. discogs.com › Paramètres › Développeurs › Générer un jeton. Ajoute les pochettes, 60 requêtes/min et les suggestions de prix par état.">
          <input type="password" autoComplete="off" value={discogs} onChange={(e) => setDiscogs(e.target.value)} placeholder="Jeton" className="mono" />
        </Field>
        <Button
          variant="accent"
          icon="check"
          onClick={() => {
            setSettings({ discogsToken: discogs.trim() || undefined, anthropicKey: anthropic.trim() || undefined })
            toast('Connecteurs enregistrés')
          }}
        >
          Enregistrer
        </Button>

        <div className="form-label section-label">Sources de marché</div>
        {CONNECTORS.map((c) => {
          const st = STATUS_TEXT[c.status()]
          return (
            <div key={c.id} className="panel connector">
              <div className="panel-head">
                <strong>{c.name}</strong>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <p className="fine">{c.summary}</p>
              <ul className="ticks">
                {c.provides.map((p) => (
                  <li key={p}>
                    <Icon name="check" size={14} /> {p}
                  </li>
                ))}
              </ul>
              <p className="fine muted">{c.limits}</p>
            </div>
          )
        })}
        <div className="panel connector">
          <div className="panel-head">
            <strong>MusicBrainz · Cover Art Archive · iTunes</strong>
            <Badge tone="up">Actif</Badge>
          </div>
          <p className="fine">Bases ouvertes ou publiques, sans clé : sorties datées, rééditions, pochettes haute définition.</p>
        </div>
      </div>
    </Sheet>
  )
}

function DataSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useApp()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => {
    if (open) navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [open])

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as PersistedState
      if (data.version !== 1 || !Array.isArray(data.records)) throw new Error()
      st.importData(data)
      st.toast(`${data.records.length} disques importés`)
      onClose()
    } catch {
      st.toast('Fichier de sauvegarde invalide', 'error')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Données & sauvegarde">
      <div className="form-stack">
        <div className="stat-grid">
          <div className="stat">
            <span className="kicker">Disques</span>
            <span className="stat-value">{st.records.length}</span>
          </div>
          <div className="stat">
            <span className="kicker">Observations de prix</span>
            <span className="stat-value">{st.prices.length}</span>
          </div>
        </div>
        <Row icon="lock" label="Stockage protégé contre la purge" value={persisted == null ? '—' : persisted ? 'Oui' : 'Non'}>
          {!persisted && (
            <Button size="sm" variant="glass" onClick={async () => setPersisted(await requestPersistence())}>
              Demander
            </Button>
          )}
        </Row>
        <Button variant="glass" icon="download" onClick={() => downloadJson(`vinyl-vault-${new Date().toISOString().slice(0, 10)}.json`, exportData())}>
          Exporter une sauvegarde (JSON)
        </Button>
        <label className="btn btn-glass btn-md file-btn">
          <Icon name="upload" size={19} />
          <span>Importer une sauvegarde</span>
          <input type="file" accept="application/json,.json" onChange={(e) => importFile(e.target.files?.[0])} />
        </label>
        <p className="fine">Les photos prises avec l’app ne sont pas incluses dans l’export JSON.</p>
        {st.records.some((r) => r.demo) ? (
          <Button variant="ghost" onClick={() => { st.clearDemo(); st.toast('Démo effacée') }}>
            Effacer la collection de démonstration
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => { st.loadDemo(); st.toast('Démo chargée (données fictives)') }}>
            Charger la collection de démonstration
          </Button>
        )}
        {confirmReset ? (
          <div className="note note-error">
            <span>Tout effacer définitivement de cet appareil ?</span>
            <div className="btn-row">
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                Annuler
              </Button>
              <Button size="sm" variant="danger" onClick={async () => { await st.resetAll(); setConfirmReset(false); st.toast('Données effacées'); onClose() }}>
                Tout effacer
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
            Réinitialiser l’application
          </Button>
        )}
      </div>
    </Sheet>
  )
}

function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Installer sur l’iPhone">
      <div className="form-stack">
        {isStandalone() ? (
          <div className="note">
            <Icon name="check" size={16} /> Vinyl Vault est déjà installée sur votre écran d’accueil.
          </div>
        ) : (
          <ol className="steps">
            <li>
              Ouvrez cette page dans <strong>Safari</strong>.
            </li>
            <li>
              Touchez le bouton <strong>Partager</strong> (carré avec une flèche vers le haut).
            </li>
            <li>
              Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.
            </li>
            <li>Lancez Vinyl Vault depuis sa nouvelle icône : elle s’ouvre en plein écran, fonctionne hors ligne et peut recevoir des notifications (iOS 16.4+).</li>
          </ol>
        )}
      </div>
    </Sheet>
  )
}

function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useApp((s) => s.toast)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState(currentSession())
  useEffect(() => {
    if (open) setSession(currentSession())
  }, [open])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast(ok)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Compte & synchronisation">
      <div className="form-stack">
        {!syncConfigured() ? (
          <>
            <div className="note">
              <Icon name="info" size={16} /> Mode local : la collection est enregistrée sur cet appareil. La synchronisation entre appareils s’active en reliant un projet Supabase
              (voir docs/SUPABASE.md dans le dépôt). En attendant, utilisez l’export/import de sauvegarde.
            </div>
          </>
        ) : session ? (
          <>
            <Row icon="user" label="Connecté" value={session.email} />
            <Button variant="accent" icon="upload" busy={busy} onClick={() => run(pushVault, 'Collection envoyée')}>
              Envoyer vers le cloud
            </Button>
            <Button variant="glass" icon="download" busy={busy} onClick={() => run(async () => { if (!(await pullVault())) throw new Error('Aucune sauvegarde distante') }, 'Collection récupérée')}>
              Récupérer depuis le cloud
            </Button>
            <Button variant="ghost" onClick={() => { signOut(); setSession(null) }}>
              Se déconnecter
            </Button>
          </>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => sendMagicLink(email), 'Lien de connexion envoyé par e-mail')
            }}
          >
            <Field label="E-mail">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Button type="submit" variant="accent" busy={busy}>
              Recevoir un lien de connexion
            </Button>
          </form>
        )}
      </div>
    </Sheet>
  )
}
