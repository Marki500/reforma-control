import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { acceptWorkspaceInvitation } from '../services/workspaceService'
import { Button } from '../components/ui/Button'
import { BrandLockup } from '../components/brand/Brand'
import { supabase } from '../services/supabaseClient'

export default function Invite() {
  const { token } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'idle', message: '' })

  async function changeAccount() {
    localStorage.setItem('nivel_pending_invite', token)
    await supabase.auth.signOut()
    navigate(`/login?invite=${encodeURIComponent(token)}`, { replace: true })
  }

  useEffect(() => {
    if (loading || !user || state.status !== 'idle') return
    setState({ status: 'loading', message: '' })
    acceptWorkspaceInvitation(token)
      .then(() => { localStorage.removeItem('nivel_pending_invite'); setState({ status: 'success', message: 'Ya tienes acceso al proyecto compartido.' }) })
      .catch(error => setState({ status: 'error', message: error.message || 'No se pudo aceptar la invitación.' }))
  }, [loading, user, token, state.status])

  if (!loading && !user) {
    const destination = `/login?invite=${encodeURIComponent(token)}`
    return <main className="safe-area-page flex min-h-[100dvh] items-center justify-center bg-stone-100 px-5"><div className="w-full max-w-md space-y-6"><BrandLockup /><div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-stone-200"><h1 className="font-display text-2xl font-bold text-stone-900">Te han invitado a una reforma</h1><p className="mt-3 text-sm leading-relaxed text-stone-500">Entra con el email que recibió la invitación. Si todavía no tienes cuenta, podrás crearla gratuitamente.</p><Button className="mt-6 w-full" onClick={() => navigate(destination)}>Entrar o crear cuenta</Button></div></div></main>
  }

  return <main className="safe-area-page flex min-h-[100dvh] items-center justify-center bg-stone-100 px-5"><div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-sm ring-1 ring-stone-200">{(loading || state.status === 'loading' || state.status === 'idle') && <><LoaderCircle className="mx-auto animate-spin text-olive" size={36} /><h1 className="mt-4 text-xl font-semibold text-stone-800">Uniéndote al proyecto…</h1></>}{state.status === 'success' && <><CircleCheck className="mx-auto text-olive" size={40} /><h1 className="mt-4 text-xl font-semibold text-stone-800">Invitación aceptada</h1><p className="mt-2 text-sm text-stone-500">{state.message}</p><Button className="mt-6 w-full" onClick={() => navigate('/dashboard', { replace: true })}>Abrir el panel</Button></>}{state.status === 'error' && <><TriangleAlert className="mx-auto text-red-500" size={40} /><h1 className="mt-4 text-xl font-semibold text-stone-800">No se pudo aceptar</h1><p className="mt-2 text-sm text-red-600">{state.message}</p><div className="mt-6 flex flex-col gap-3"><Button onClick={changeAccount}>Entrar con otra cuenta</Button><Link to="/dashboard" className="text-sm font-semibold text-stone-700 underline">Volver al panel</Link></div></>}</div></main>
}
