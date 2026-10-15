import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { BrandLockup } from '../components/brand/Brand'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault(); setError('')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setError(updateError.message); setBusy(false); return }
    await supabase.auth.signOut()
    navigate('/login', { replace: true, state: { passwordUpdated: true } })
  }

  return <main className="safe-area-page grid min-h-[100dvh] place-items-center bg-stone-100 px-5"><div className="w-full max-w-md"><BrandLockup className="mb-8" /><form onSubmit={submit} className="space-y-5 rounded-3xl bg-white p-7 shadow-[0_18px_50px_rgba(37,42,35,.08)]"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-terracotta">Recuperar acceso</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.035em] text-stone-900">Crea una nueva contraseña</h1></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Input label="Nueva contraseña" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} required autoFocus /><Input label="Repetir contraseña" type="password" value={confirm} onChange={event => setConfirm(event.target.value)} minLength={8} required /><Button type="submit" className="w-full" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</Button></form></div></main>
}
