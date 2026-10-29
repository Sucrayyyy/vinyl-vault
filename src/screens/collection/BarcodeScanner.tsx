import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Button, Field } from '../../components/ui'
import { compressImage } from '../../lib/image'
import { haptic } from '../../lib/util'
import { detectBarcode, isValidEan } from '../../services/recognition/barcode'

type CamState = 'starting' | 'live' | 'denied' | 'unavailable' | 'error'

/** Lecture de code-barres en direct (caméra arrière), avec photo et saisie manuelle en secours. */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<CamState>('starting')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string>()
  const done = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let alive = true

    const tick = async () => {
      if (!alive || done.current) return
      const v = video.current
      if (v && v.readyState >= 2) {
        try {
          const code = await detectBarcode(v)
          if (code && isValidEan(code) && !done.current) {
            done.current = true
            haptic(20)
            onCode(code)
            return
          }
        } catch {
          /* moteur en cours de chargement */
        }
      }
      timer = setTimeout(tick, 280)
    }

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (!alive) return stream.getTracks().forEach((t) => t.stop())
        const v = video.current!
        v.srcObject = stream
        v.setAttribute('playsinline', 'true')
        await v.play()
        setState('live')
        tick()
      } catch (e) {
        const name = (e as Error).name
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error')
      }
    })()

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCode])

  const fromPhoto = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setHint(undefined)
    try {
      const img = await compressImage(file, 1600, 0.9)
      const bmp = await createImageBitmap(img)
      const code = await detectBarcode(bmp)
      bmp.close()
      if (code) {
        done.current = true
        onCode(code)
      } else setHint('Aucun code-barres lisible sur cette photo. Rapprochez-vous et évitez les reflets.')
    } catch {
      setHint('Lecture impossible. Saisissez les chiffres sous le code-barres.')
    } finally {
      setBusy(false)
    }
  }

  const submitManual = () => {
    const code = manual.replace(/\D/g, '')
    if (code.length < 8) {
      setHint('Un code EAN/UPC compte 8, 12 ou 13 chiffres.')
      return
    }
    onCode(code)
  }

  return (
    <div className="scanner">
      <div className="scanner-view">
        <video ref={video} muted playsInline className={state === 'live' ? 'is-live' : ''} />
        {state === 'live' && (
          <div className="scanner-frame" aria-hidden>
            <motion.span className="scanner-line" animate={{ y: ['0%', '100%', '0%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
          </div>
        )}
        {state !== 'live' && (
          <div className="scanner-msg">
            <Icon name={state === 'starting' ? 'camera' : 'alert'} size={26} />
            {state === 'starting' && <p>Ouverture de la caméra…</p>}
            {state === 'denied' && (
              <p>
                Accès à la caméra refusé. Sur iPhone : Réglages › Safari › Caméra › Autoriser (ou rouvrez l’app et acceptez la demande). Vous pouvez aussi utiliser une
                photo ou saisir le code.
              </p>
            )}
            {state === 'unavailable' && <p>Caméra indisponible sur cet appareil. Utilisez une photo ou la saisie manuelle.</p>}
            {state === 'error' && <p>La caméra n’a pas pu démarrer. Utilisez une photo ou la saisie manuelle.</p>}
          </div>
        )}
      </div>
      <p className="fine center">Placez le code-barres au dos de la pochette dans le cadre.</p>

      <label className="btn btn-glass btn-md btn-block file-btn">
        <Icon name="image" size={19} />
        <span>{busy ? 'Analyse…' : 'Lire depuis une photo'}</span>
        <input type="file" accept="image/*" onChange={(e) => fromPhoto(e.target.files?.[0])} />
      </label>

      <div className="form-row align-end">
        <Field label="Saisie manuelle">
          <input inputMode="numeric" className="mono" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="0 602547 924031" onKeyDown={(e) => e.key === 'Enter' && submitManual()} />
        </Field>
        <Button variant="accent" onClick={submitManual}>
          OK
        </Button>
      </div>
      {hint && <p className="note">{hint}</p>}
    </div>
  )
}
