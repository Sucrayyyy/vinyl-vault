// Reconnaissance de pochette par Claude (vision) — optionnelle.
// La clé API est fournie par l'utilisateur, stockée uniquement sur son appareil
// et envoyée directement à l'API Anthropic (jamais dans le dépôt ni à un tiers).
import Anthropic from '@anthropic-ai/sdk'
import { blobToBase64 } from '../../lib/image'

export interface VisionGuess {
  artist: string
  title: string
  catno?: string
  label?: string
  confidence: number
  visibleText: string
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['artist', 'title', 'confidence', 'visibleText', 'catno', 'label'],
  properties: {
    artist: { type: 'string', description: "Nom de l'artiste, ou chaîne vide si inconnu" },
    title: { type: 'string', description: "Titre de l'album, ou chaîne vide si inconnu" },
    catno: { type: 'string', description: 'Référence catalogue lisible, sinon chaîne vide' },
    label: { type: 'string', description: 'Label lisible, sinon chaîne vide' },
    confidence: { type: 'number', description: 'Confiance entre 0 et 1' },
    visibleText: { type: 'string', description: 'Texte lisible sur la pochette' },
  },
}

export async function identifyCover(image: Blob, apiKey: string): Promise<VisionGuess> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60000 })
  const data = await blobToBase64(image)
  const msg = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          {
            type: 'text',
            text:
              "Cette photo montre la pochette d'un disque vinyle. Identifie l'artiste et l'album. " +
              "Si tu n'es pas sûr, donne ta meilleure hypothèse avec une confiance basse ; si rien n'est identifiable, laisse artist et title vides.",
          },
        ],
      },
    ],
  })
  if (msg.stop_reason === 'refusal') throw new Error("La reconnaissance a été refusée pour cette image.")
  const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  const parsed = JSON.parse(text) as VisionGuess
  return {
    ...parsed,
    catno: parsed.catno || undefined,
    label: parsed.label || undefined,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
  }
}

export function describeVisionError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'Clé API Anthropic invalide.'
  if (e instanceof Anthropic.RateLimitError) return 'Limite de requêtes atteinte côté Anthropic.'
  if (e instanceof Anthropic.APIConnectionError) return 'Connexion à Anthropic impossible.'
  if (e instanceof Anthropic.APIError) return `Service de reconnaissance indisponible (${e.status ?? 'erreur'}).`
  return e instanceof Error ? e.message : 'Reconnaissance impossible.'
}
