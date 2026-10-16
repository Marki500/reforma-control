import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MailCheck, RefreshCw } from 'lucide-react'
import { supabase } from '../services/supabaseClient'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BrandLockup, BrandMark } from '../components/brand/Brand'

export default function Login() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const inviteToken = searchParams.get('invite')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('login')
  const [pendingEmail, setPendingEmail] = useState('')
  const [notice, setNotice] = useState(location.state?.passwordUpdated ? 'Contraseña actualizada. Ya puedes entrar.' : '')

  useEffect(() => {
    if (inviteToken) localStorage.setItem('nivel_pending_invite', inviteToken)
  }, [inviteToken])

  const confirmationRedirectTo = inviteToken
    ? `${window.location.origin}/invite/${encodeURIComponent(inviteToken)}`
    : `${window.location.origin}/`

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'recover') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
        if (error) throw error
        setNotice('Te hemos enviado un enlace para crear una nueva contraseña.')
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: confirmationRedirectTo } })
        if (error) throw error
        setPendingEmail(email.trim())
        setPassword('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function resendConfirmation() {
    setLoading(true)
    setError(null)
    setNotice('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail, options: { emailRedirectTo: confirmationRedirectTo } })
      if (error) throw error
      setNotice('Correo reenviado. Puede tardar unos minutos en llegar.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function backToLogin() {
    setPendingEmail('')
    setMode('login')
    setError(null)
    setNotice('')
  }

  return (
    <main className="grid min-h-[100dvh] bg-stone-100 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-stone-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-terracotta/20 blur-3xl" />
        <BrandLockup inverse className="relative z-10" />
        <div className="relative z-10 max-w-xl pb-8">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Todo encaja</p>
          <h1 className="font-display text-6xl font-bold leading-[0.96] tracking-[-0.055em] text-balance">Tu reforma,<br /><span className="font-serif font-normal italic text-white/72">a nivel.</span></h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-white/50">Materiales, presupuestos, tareas y profesionales en un solo lugar. Sin hojas sueltas ni decisiones perdidas.</p>
        </div>
        <div className="relative z-10 flex items-center gap-3 text-xs text-white/30"><span className="h-px w-10 bg-white/20" /> CONTROL DE OBRA · 2026</div>
      </section>

      <section className="safe-area-page flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden"><BrandLockup /></div>
          <div className="mb-7">
            <BrandMark className="mb-6 hidden h-12 w-12 text-stone-900 lg:block" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terracotta">{pendingEmail ? 'Cuenta creada' : mode === 'login' ? 'Bienvenido de nuevo' : mode === 'recover' ? 'Recuperar acceso' : 'Empieza tu proyecto'}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.035em] text-stone-900">{pendingEmail ? 'Revisa tu correo' : mode === 'login' ? 'Accede a NIVEL' : mode === 'recover' ? 'Recupera tu cuenta' : 'Crea tu cuenta'}</h2>
            <p className="mt-2 text-sm text-stone-500">{pendingEmail ? 'Falta un último paso para activar tu cuenta.' : inviteToken ? 'Accede con el email que recibió la invitación.' : mode === 'login' ? 'Continúa donde dejaste tu reforma.' : mode === 'recover' ? 'Te enviaremos un enlace seguro por correo.' : 'Pon orden desde el primer día.'}</p>
          </div>

          {pendingEmail ? <section aria-live="polite" className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_rgba(37,42,35,0.1)] ring-1 ring-stone-200/70">
            <div className="bg-olive-light px-6 py-7 text-center sm:px-8">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-olive shadow-sm ring-1 ring-olive/10"><MailCheck size={34} strokeWidth={1.8} /></span>
              <h3 className="mt-5 font-display text-2xl font-bold tracking-[-0.03em] text-stone-900">Te hemos enviado un enlace</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-600">Abre el correo enviado a</p>
              <p className="mt-1 break-all text-base font-bold text-stone-900">{pendingEmail}</p>
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <ol className="space-y-3 text-sm text-stone-600">
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-white">1</span><span className="pt-0.5">Busca el correo de <strong className="text-stone-800">NIVEL</strong> en tu bandeja de entrada.</span></li>
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-white">2</span><span className="pt-0.5">Pulsa <strong className="text-stone-800">“Confirmar mi cuenta”</strong> para activar el acceso.</span></li>
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-white">3</span><span className="pt-0.5">Si no aparece, revisa las carpetas de spam o promociones.</span></li>
              </ol>
              {inviteToken && <p className="rounded-xl bg-terracotta-light px-4 py-3 text-sm leading-relaxed text-stone-700">Después de confirmar volverás a NIVEL para aceptar la invitación a la reforma.</p>}
              {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
              {notice && <p role="status" className="rounded-xl bg-olive-light px-4 py-3 text-sm text-olive">{notice}</p>}
              <div className="grid gap-2.5">
                <Button type="button" variant="olive" className="w-full" onClick={resendConfirmation} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{loading ? 'Reenviando…' : 'Reenviar correo'}</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={backToLogin}><ArrowLeft size={16} /> Volver a iniciar sesión</Button>
              </div>
            </div>
          </section> : <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-[0_18px_50px_rgba(37,42,35,0.08)] ring-1 ring-stone-200/70 sm:p-7">
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {mode !== 'recover' && <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />}

            {error && (
              <p className={`text-sm ${error.includes('Revisa') ? 'text-olive' : 'text-red-500'}`}>
                {error}
              </p>
            )}
            {notice && <p role="status" className="rounded-xl bg-olive-light p-3 text-sm text-olive">{notice}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Procesando…' : mode === 'login' ? 'Entrar' : mode === 'recover' ? 'Enviar enlace' : 'Crear cuenta'}
            </Button>

            {mode === 'login' && <button type="button" onClick={() => { setMode('recover'); setError(null); setNotice('') }} className="w-full text-center text-sm font-medium text-stone-500 hover:text-stone-800">He olvidado mi contraseña</button>}

            <p className="text-center text-sm text-stone-500">
              {mode === 'recover' ? <button type="button" onClick={() => { setMode('login'); setError(null); setNotice('') }} className="font-semibold text-stone-800 hover:underline">Volver a entrar</button> : mode === 'login' ? (
                <>
                  ¿No tienes cuenta?{' '}
                  <button type="button" onClick={() => { setMode('register'); setError(null) }} className="font-semibold text-stone-800 hover:underline">Registrarse</button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(null) }} className="font-semibold text-stone-800 hover:underline">Entrar</button>
                </>
              )}
            </p>
          </form>}
        </div>
      </section>
    </main>
  )
}
