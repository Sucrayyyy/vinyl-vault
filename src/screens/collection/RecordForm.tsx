import { CONDITIONS, CONDITION_LABELS, type Condition, type VinylRecord } from '../../lib/types'
import { Chip, Field, Segmented } from '../../components/ui'

export type Draft = Omit<VinylRecord, 'id' | 'createdAt' | 'updatedAt'>

export const emptyDraft = (): Draft => ({ artist: '', title: '', pressing: 'unknown', genres: [], styles: [], discs: 1 })

function ConditionPicker({ value, onChange }: { value?: Condition; onChange: (c?: Condition) => void }) {
  return (
    <div className="chip-wrap">
      {CONDITIONS.map((c) => (
        <Chip key={c} active={value === c} onClick={() => onChange(value === c ? undefined : c)}>
          {c}
        </Chip>
      ))}
    </div>
  )
}

const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')))

/** Formulaire complet d'un disque (ajout et modification). */
export function RecordForm({ draft, onChange, compact = false }: { draft: Draft; onChange: (d: Draft) => void; compact?: boolean }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v })
  return (
    <div className="form-stack">
      {!compact && (
        <>
          <Field label="Artiste">
            <input value={draft.artist} onChange={(e) => set('artist', e.target.value)} autoComplete="off" required />
          </Field>
          <Field label="Titre de l’album">
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} autoComplete="off" required />
          </Field>
        </>
      )}

      <div className="form-label section-label">État</div>
      <div className="form-group">
        <div className="form-label">
          Disque {draft.mediaCondition && <span className="muted">— {CONDITION_LABELS[draft.mediaCondition]}</span>}
        </div>
        <ConditionPicker value={draft.mediaCondition} onChange={(c) => set('mediaCondition', c)} />
      </div>
      <div className="form-group">
        <div className="form-label">
          Pochette {draft.sleeveCondition && <span className="muted">— {CONDITION_LABELS[draft.sleeveCondition]}</span>}
        </div>
        <ConditionPicker value={draft.sleeveCondition} onChange={(c) => set('sleeveCondition', c)} />
      </div>

      <div className="form-label section-label">Achat</div>
      <div className="form-row">
        <Field label="Prix payé (€)">
          <input inputMode="decimal" value={draft.purchasePrice ?? ''} onChange={(e) => set('purchasePrice', num(e.target.value))} placeholder="0" />
        </Field>
        <Field label="Date">
          <input type="date" value={draft.purchaseDate ?? ''} onChange={(e) => set('purchaseDate', e.target.value || undefined)} />
        </Field>
      </div>
      <Field label="Lieu ou vendeur">
        <input value={draft.purchasePlace ?? ''} onChange={(e) => set('purchasePlace', e.target.value || undefined)} placeholder="Disquaire, brocante, Discogs…" />
      </Field>

      <div className="form-label section-label">Édition</div>
      <div className="form-group">
        <Segmented
          value={draft.pressing}
          onChange={(v) => set('pressing', v)}
          options={[
            { value: 'original', label: 'Originale' },
            { value: 'reissue', label: 'Réédition' },
            { value: 'unknown', label: 'Inconnu' },
          ]}
        />
      </div>
      <div className="form-row">
        <Field label="Année">
          <input inputMode="numeric" value={draft.year ?? ''} onChange={(e) => set('year', num(e.target.value))} />
        </Field>
        <Field label="Pays">
          <input value={draft.country ?? ''} onChange={(e) => set('country', e.target.value || undefined)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Label">
          <input value={draft.label ?? ''} onChange={(e) => set('label', e.target.value || undefined)} />
        </Field>
        <Field label="Référence">
          <input value={draft.catno ?? ''} onChange={(e) => set('catno', e.target.value || undefined)} className="mono" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Couleur du vinyle">
          <input value={draft.color ?? ''} onChange={(e) => set('color', e.target.value || undefined)} placeholder="Noir" />
        </Field>
        <Field label="Disques">
          <input inputMode="numeric" value={draft.discs ?? ''} onChange={(e) => set('discs', num(e.target.value))} />
        </Field>
      </div>
      <Field label="Code-barres">
        <input inputMode="numeric" value={draft.barcode ?? ''} onChange={(e) => set('barcode', e.target.value.replace(/\D/g, '') || undefined)} className="mono" />
      </Field>
      <Field label="Genres et styles" hint="Séparés par des virgules">
        <input
          value={[...draft.genres, ...draft.styles].join(', ')}
          onChange={(e) => onChange({ ...draft, genres: e.target.value.split(',').map((s) => s.trim()).filter(Boolean), styles: [] })}
        />
      </Field>

      <div className="form-label section-label">Organisation</div>
      <Field label="Étagère ou bac">
        <input value={draft.shelf ?? ''} onChange={(e) => set('shelf', e.target.value || undefined)} placeholder="Ex. Bac A, étagère salon" />
      </Field>
      <Field label="Notes">
        <textarea rows={3} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
      </Field>
    </div>
  )
}
