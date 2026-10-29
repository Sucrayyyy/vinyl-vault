import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { LogoMark } from '../../components/Logo'
import { useApp } from '../../lib/store'
import { haptic } from '../../lib/util'

type Step = 'welcome' | 'name' | 'first'

const ease = [0.22, 1, 0.36, 1] as const

/** Accueil d'un nouvel utilisateur : bienvenue animée, prénom, premier vinyle. */
export function Onboarding() {
  const finish = useApp((s) => s.finishOnboarding)
  const setAddOpen = useApp((s) => s.setAddOpen)
  const loadDemo = useApp((s) => s.loadDemo)
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState(() => useApp.getState().profile.displayName)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'name') setTimeout(() => input.current?.focus(), 450)
  }, [step])

  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 30)
  const first = clean.split(' ')[0]

  const done = (then?: 'scan' | 'demo') => {
    haptic(14)
    finish(clean)
    if (then === 'demo') loadDemo()
    if (then === 'scan') setTimeout(() => setAddOpen(true), 500)
  }

  return (
    <motion.div className="onb" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }} transition={{ duration: 0.6, ease }}>
      <div className="onb-orbs" aria-hidden>
        <motion.span className="onb-orb a" animate={{ x: [0, 30, -10, 0], y: [0, -20, 15, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.span className="onb-orb b" animate={{ x: [0, -25, 20, 0], y: [0, 25, -10, 0] }} transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.span className="onb-orb c" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />
      </div>

      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.section key="welcome" className="onb-step" exit={{ opacity: 0, y: -30, transition: { duration: 0.35 } }}>
            <div className="onb-stage">
              <motion.div className="onb-sleeve" initial={{ x: 0, rotate: -8, opacity: 0, scale: 0.85 }} animate={{ x: '-22%', rotate: -4, opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease, delay: 0.2 }}>
                <LogoMark size={44} />
                <span className="onb-sleeve-text mono">VINYL VAULT · VOL. 1</span>
              </motion.div>
              <motion.div className="onb-record" initial={{ x: '-30%', opacity: 0 }} animate={{ x: '24%', opacity: 1 }} transition={{ duration: 1.3, ease, delay: 0.75 }}>
                <motion.div className="onb-record-spin" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
                  <div className="vinyl">
                    <div className="vinyl-label">
                      <span className="vinyl-hole" />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>

            <div className="onb-copy">
              <motion.p className="kicker center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.6, ease }}>
                Bienvenue
              </motion.p>
              <h1 className="display onb-title">
                {['dans', 'votre'].map((w, i) => (
                  <motion.span key={w} className="onb-word" initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 1.35 + i * 0.12, duration: 0.8, ease }}>
                    {w}
                  </motion.span>
                ))}
                <br />
                <motion.em className="onb-word onb-accent" initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 1.62, duration: 0.9, ease }}>
                  Vinyl Vault
                </motion.em>
              </h1>
              <motion.p className="onb-lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 0.8 }}>
                Scannez vos disques, suivez leur valeur et découvrez les pressages qui manquent à votre collection.
              </motion.p>
            </div>

            <motion.button
              type="button"
              className="btn btn-accent btn-lg btn-block onb-cta"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.2, duration: 0.7, ease }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                haptic()
                setStep('name')
              }}
            >
              <span>Commencer</span>
              <Icon name="chevron" size={18} />
            </motion.button>
          </motion.section>
        )}

        {step === 'name' && (
          <motion.form
            key="name"
            className="onb-step onb-form"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6, ease }}
            onSubmit={(e) => {
              e.preventDefault()
              if (clean) setStep('first')
            }}
          >
            <div className="onb-copy left">
              <p className="kicker">Étape 1 sur 2</p>
              <h1 className="display onb-title small">Comment vous appelez-vous ?</h1>
              <p className="onb-lead">Votre prénom personnalise votre espace. Il reste sur cet appareil.</p>
            </div>
            <label className="onb-input">
              <input
                ref={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre prénom"
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                maxLength={30}
                aria-label="Prénom"
              />
              <motion.span className="onb-input-line" animate={{ scaleX: clean ? 1 : 0.15 }} transition={{ duration: 0.5, ease }} />
            </label>
            <div className="onb-actions">
              <button type="button" className="btn btn-ghost btn-md" onClick={() => setStep('welcome')}>
                Retour
              </button>
              <motion.button type="submit" className="btn btn-accent btn-lg" disabled={!clean} whileTap={{ scale: 0.97 }}>
                <span>Continuer</span>
                <Icon name="chevron" size={18} />
              </motion.button>
            </div>
          </motion.form>
        )}

        {step === 'first' && (
          <motion.section key="first" className="onb-step" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease }}>
            <div className="onb-copy left">
              <p className="kicker">Étape 2 sur 2</p>
              <h1 className="display onb-title small">
                Enchanté,{' '}
                <motion.em className="onb-accent" initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ delay: 0.3, duration: 0.8 }}>
                  {first}
                </motion.em>
                .
              </h1>
              <p className="onb-lead">Votre coffre est prêt. On y range votre premier vinyle ?</p>
            </div>

            <motion.div className="onb-scan-card" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, duration: 0.7, ease }}>
              <div className="onb-scan-frame">
                <motion.span className="onb-scan-line" animate={{ y: ['0%', '100%', '0%'] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />
                <Icon name="camera" size={30} />
              </div>
              <p>Photographiez une pochette : l’album et son édition sont identifiés pour vous.</p>
            </motion.div>

            <div className="onb-stack">
              <motion.button type="button" className="btn btn-accent btn-lg btn-block" whileTap={{ scale: 0.97 }} onClick={() => done('scan')}>
                <Icon name="camera" size={19} />
                <span>Scanner mon premier vinyle</span>
              </motion.button>
              <button type="button" className="btn btn-glass btn-lg btn-block" onClick={() => done()}>
                Plus tard
              </button>
              <button type="button" className="onb-demo" onClick={() => done('demo')}>
                Explorer avec une collection de démonstration (fictive)
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
