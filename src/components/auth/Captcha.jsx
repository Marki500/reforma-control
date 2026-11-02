import { useEffect, useRef, useState } from 'react'

export const captchaSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || ''
let scriptPromise

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      const fail = () => { clearTimeout(timer); script.remove(); reject(new Error('Turnstile unavailable')) }
      const timer = setTimeout(fail, 20000)
      script.onload = () => { clearTimeout(timer); window.turnstile ? resolve(window.turnstile) : fail() }
      script.onerror = fail
      document.head.appendChild(script)
    }).catch(error => { scriptPromise = undefined; throw error })
  }
  return scriptPromise
}

export default function Captcha({ onToken }) {
  const container = useRef(null)
  const callback = useRef(onToken)
  callback.current = onToken
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!captchaSiteKey) return
    let disposed = false
    let widget
    let api
    callback.current('')
    setError(false)
    loadTurnstile().then(turnstile => {
      if (disposed) return
      api = turnstile
      widget = api.render(container.current, {
        sitekey: captchaSiteKey,
        language: 'es',
        theme: 'light',
        size: 'flexible',
        callback: token => { if (!disposed) { setError(false); callback.current(token) } },
        'expired-callback': () => { if (!disposed) callback.current('') },
        'error-callback': () => { if (!disposed) { callback.current(''); setError(true) } },
        'timeout-callback': () => { if (!disposed) { callback.current(''); setError(true) } },
      })
    }).catch(() => { if (!disposed) setError(true) })
    return () => {
      disposed = true
      if (widget !== undefined) api.remove(widget)
    }
  }, [attempt])

  if (!captchaSiteKey) return null
  return <div className="space-y-2">
    <div ref={container} />
    {error && <div role="alert" className="text-sm text-red-600">No se pudo completar la verificación. Comprueba tu conexión o el bloqueador de contenido. <button type="button" className="font-semibold underline" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
  </div>
}
