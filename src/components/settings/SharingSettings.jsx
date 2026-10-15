import { useEffect, useState } from 'react'
import { Copy, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import ConfirmDialog from '../ui/ConfirmDialog'
import { authenticatedRequest } from '../../services/uploadService'
import {
  cancelWorkspaceInvitation, createWorkspaceInvitation, getWorkspaceContext,
  getWorkspaceInvitations, getWorkspaceMembers, getUserProjects, removeWorkspaceMember, switchProject,
} from '../../services/workspaceService'

function inviteUrl(token) {
  return `${window.location.origin}/invite/${token}`
}

export default function SharingSettings() {
  const [context, setContext] = useState(null)
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [projects, setProjects] = useState([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [removeMember, setRemoveMember] = useState(null)

  async function load() {
    setError('')
    try {
      const current = await getWorkspaceContext({ fresh: true })
      setContext(current)
      const [memberRows, invitationRows, projectRows] = await Promise.all([
        getWorkspaceMembers(), current.role === 'owner' ? getWorkspaceInvitations() : Promise.resolve([]), getUserProjects(),
      ])
      setMembers(memberRows)
      setInvitations(invitationRows)
      setProjects(projectRows)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el acceso compartido.')
    }
  }

  useEffect(() => { load() }, [])

  async function invite(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const token = await createWorkspaceInvitation(email)
      const url = inviteUrl(token)
      await navigator.clipboard?.writeText(url).catch(() => {})
      try {
        await sendInvitationEmail(token)
        setNotice(`Invitación enviada a ${email.trim()}. También hemos copiado el enlace.`)
      } catch (mailError) {
        setNotice('Invitación creada y enlace copiado.')
        setError(mailError.message || 'No se pudo enviar el correo; puedes compartir el enlace manualmente.')
      }
      setEmail('')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo crear la invitación.')
    } finally { setBusy(false) }
  }

  async function sendInvitationEmail(token) {
    return authenticatedRequest('/api/send-project-invitation', JSON.stringify({ token }), { 'Content-Type': 'application/json' })
  }

  async function resendInvitation(invitation) {
    setBusy(true); setError(''); setNotice('')
    try {
      await sendInvitationEmail(invitation.token)
      setNotice(`Invitación reenviada a ${invitation.email}.`)
    } catch (err) {
      setError(err.message || 'No se pudo reenviar la invitación.')
    } finally { setBusy(false) }
  }

  async function changeProject(event) { try { await switchProject(event.target.value); window.location.reload() } catch (err) { setError(err.message) } }

  async function copyInvitation(token) {
    await navigator.clipboard.writeText(inviteUrl(token))
    setNotice('Enlace copiado.')
  }

  async function cancel(id) {
    try { await cancelWorkspaceInvitation(id); await load() }
    catch (err) { setError(err.message || 'No se pudo cancelar la invitación.') }
  }

  async function confirmRemove() {
    try { await removeWorkspaceMember(removeMember.user_id); setRemoveMember(null); await load() }
    catch (err) { setRemoveMember(null); setError(err.message || 'No se pudo retirar el acceso.') }
  }

  return <section className="space-y-4">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-olive/10 p-2.5 text-olive"><Users size={20} /></span><div className="flex-1"><h2 className="text-lg font-semibold text-stone-700">Proyecto y personas</h2><p className="mt-1 text-sm text-stone-500">Cambia de reforma o compártela sin compartir tu contraseña.</p>{projects.length > 1 && <select className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" value={context?.project_id || ''} onChange={changeProject}>{projects.map(project => <option key={project.project_id} value={project.project_id}>{project.name}</option>)}</select>}</div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-olive/10 p-3 text-sm text-olive">{notice}</p>}
    <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70">
      {members.map(member => <div key={member.user_id} className="flex items-center justify-between gap-3 px-4 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-medium text-stone-800">{member.email}</p><p className="mt-0.5 text-xs text-stone-400">{{ owner: 'Propietario', editor: 'Puede editar', viewer: 'Solo lectura' }[member.role]}</p></div>{context?.role === 'owner' && member.role !== 'owner' && <button type="button" onClick={() => setRemoveMember(member)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-500" title="Retirar acceso"><Trash2 size={16} /></button>}</div>)}
    </div>
    {context?.role === 'owner' && <>
      <form onSubmit={invite} className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 sm:flex-row sm:items-end"><div className="flex-1"><Input label="Email de la persona" type="email" placeholder="pareja@email.com" value={email} onChange={event => setEmail(event.target.value)} required /></div><Button type="submit" disabled={busy || !email.trim()}><UserPlus size={16} />{busy ? 'Creando…' : 'Invitar'}</Button></form>
      {invitations.length > 0 && <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Invitaciones pendientes</p>{invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-3"><div><p className="text-sm text-stone-700">{invitation.email}</p><p className="text-xs text-stone-400">Caduca {new Date(invitation.expires_at).toLocaleDateString('es-ES')}</p></div><div className="flex gap-1"><button type="button" onClick={() => copyInvitation(invitation.token)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" title="Copiar enlace"><Copy size={16} /></button><button type="button" disabled={busy} onClick={() => resendInvitation(invitation)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-40" title="Reenviar por email"><Mail size={16} /></button><button type="button" onClick={() => cancel(invitation.id)} className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-500" title="Cancelar"><Trash2 size={16} /></button></div></div>)}</div>}
    </>}
    {context && context.role !== 'owner' && <p className="text-xs leading-relaxed text-stone-400">El propietario del proyecto gestiona las invitaciones y puede retirar accesos.</p>}
    <ConfirmDialog open={Boolean(removeMember)} title="Retirar acceso" message={`¿Retirar el acceso de ${removeMember?.email || 'esta persona'}? Su cuenta se conservará, pero dejará de ver este proyecto.`} onConfirm={confirmRemove} onCancel={() => setRemoveMember(null)} />
  </section>
}
