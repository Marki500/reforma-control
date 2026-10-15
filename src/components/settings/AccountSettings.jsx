import { useEffect, useState } from 'react'
import { KeyRound, LogOut, Mail, MonitorSmartphone, Save, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export default function AccountSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setName(user?.user_metadata?.full_name || user?.user_metadata?.name || '')
    setEmail(user?.email || '')
  }, [user])

  async function run(key, operation, success) {
    setBusy(key); setError(''); setNotice('')
    try { await operation(); setNotice(success) }
    catch (err) { setError(err.message || 'No se pudo guardar el cambio.') }
    finally { setBusy('') }
  }

  function saveName(event) {
    event.preventDefault()
    run('name', async () => {
      const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
      if (updateError) throw updateError
    }, 'Nombre actualizado.')
  }

  function saveEmail(event) {
    event.preventDefault()
    if (email.trim() === user?.email) return
    run('email', async () => {
      const { error: updateError } = await supabase.auth.updateUser({ email: email.trim() })
      if (updateError) throw updateError
    }, 'Revisa el nuevo correo para confirmar el cambio.')
  }

  function savePassword(event) {
    event.preventDefault()
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirmPassword) return setError('Las contraseñas no coinciden.')
    run('password', async () => {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPassword(''); setConfirmPassword('')
    }, 'Contraseña actualizada.')
  }

  async function closeOtherSessions() {
    await run('sessions', async () => {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
      if (signOutError) throw signOutError
    }, 'Se han cerrado las demás sesiones.')
  }

  async function closeAllSessions() {
    setBusy('logout')
    await supabase.auth.signOut({ scope: 'global' })
    navigate('/login', { replace: true })
  }

  return <section className="space-y-4">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-olive-light p-2.5 text-olive"><UserRound size={20} /></span><div><h2 className="text-lg font-semibold text-stone-700">Tu cuenta</h2><p className="mt-1 text-sm text-stone-500">Identidad, acceso y sesiones abiertas.</p></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-olive-light p-3 text-sm text-olive">{notice}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={saveName} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70"><div className="flex items-center gap-2 text-sm font-semibold text-stone-700"><UserRound size={17} /> Nombre visible</div><Input label="Nombre" value={name} onChange={event => setName(event.target.value)} placeholder="Cómo quieres aparecer" maxLength={80} /><Button type="submit" size="sm" disabled={busy === 'name' || !name.trim()}><Save size={15} />{busy === 'name' ? 'Guardando…' : 'Guardar nombre'}</Button></form>
      <form onSubmit={saveEmail} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70"><div className="flex items-center gap-2 text-sm font-semibold text-stone-700"><Mail size={17} /> Correo</div><Input label="Email de acceso" type="email" value={email} onChange={event => setEmail(event.target.value)} required /><Button type="submit" size="sm" disabled={busy === 'email' || email.trim() === user?.email}>Cambiar correo</Button></form>
      <form onSubmit={savePassword} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70"><div className="flex items-center gap-2 text-sm font-semibold text-stone-700"><KeyRound size={17} /> Contraseña</div><Input label="Nueva contraseña" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} /><Input label="Repetir contraseña" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} /><Button type="submit" size="sm" disabled={busy === 'password' || !password}>Actualizar contraseña</Button></form>
      <div className="space-y-4 rounded-2xl bg-stone-900 p-5 text-white"><div className="flex items-center gap-2 text-sm font-semibold"><MonitorSmartphone size={17} /> Sesiones</div><div><p className="text-sm text-white/75">Sesión actual activa</p><p className="mt-1 text-xs text-white/40">Último acceso: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('es-ES') : 'Ahora'}</p></div><div className="flex flex-col gap-2"><Button type="button" size="sm" variant="secondary" onClick={closeOtherSessions} disabled={busy === 'sessions'}>Cerrar las demás sesiones</Button><button type="button" onClick={closeAllSessions} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white"><LogOut size={15} /> Cerrar sesión en todos los dispositivos</button></div></div>
    </div>
  </section>
}
