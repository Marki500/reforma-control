import { useEffect, useState } from 'react'
import { Bell, MessageCircle, Send, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { authenticatedRequest } from '../../services/uploadService'
import {
  createProjectComment, deleteProjectComment, getProjectComments, getProjectNotificationPreferences,
  getWorkspaceContext, getWorkspaceMembers, updateProjectNotificationPreferences,
} from '../../services/workspaceService'
import { Button } from '../ui/Button'

export default function ProjectConversation() {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [members, setMembers] = useState([])
  const [context, setContext] = useState(null)
  const [body, setBody] = useState('')
  const [preferences, setPreferences] = useState({ email_comments: false, email_mentions: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    try {
      const [commentRows, memberRows, prefs, workspace] = await Promise.all([getProjectComments(), getWorkspaceMembers(), getProjectNotificationPreferences(), getWorkspaceContext()])
      setComments(commentRows); setMembers(memberRows); setPreferences(prefs); setContext(workspace)
    } catch (err) { setError(err.message || 'No se pudo cargar la conversación.') }
  }
  useEffect(() => { load() }, [])

  function mention(email) {
    const token = `@${email}`
    setBody(current => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${token} `)
  }

  async function submit(event) {
    event.preventDefault(); if (!body.trim()) return
    setBusy(true); setError(''); setNotice('')
    try {
      const commentId = await createProjectComment(body)
      setBody(''); await load()
      authenticatedRequest('/api/send-comment-notifications', JSON.stringify({ comment_id: commentId }), { 'Content-Type': 'application/json' })
        .then(result => { if (result.sent > 0) setNotice(`Comentario guardado y ${result.sent} aviso${result.sent === 1 ? '' : 's'} enviado${result.sent === 1 ? '' : 's'}.`) })
        .catch(() => setNotice('Comentario guardado. No se pudieron enviar todos los avisos por email.'))
    } catch (err) { setError(err.message || 'No se pudo publicar el comentario.') }
    finally { setBusy(false) }
  }

  async function remove(id) {
    try { await deleteProjectComment(id); await load() }
    catch (err) { setError(err.message || 'No se pudo eliminar el comentario.') }
  }

  async function changePreference(key, value) {
    const next = { ...preferences, [key]: value }
    setPreferences(next); setError('')
    try { await updateProjectNotificationPreferences(next) }
    catch (err) { setPreferences(preferences); setError(err.message || 'No se pudieron guardar los avisos.') }
  }

  return <section className="space-y-4">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-olive-light p-2.5 text-olive"><MessageCircle size={20} /></span><div><h2 className="text-lg font-semibold text-stone-700">Conversación</h2><p className="mt-1 text-sm text-stone-500">Notas compartidas y menciones para no perder decisiones.</p></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-olive-light p-3 text-sm text-olive">{notice}</p>}
    <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
      <div className="space-y-3">
        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70"><label className="block"><span className="mb-1.5 block text-sm font-medium text-stone-700">Nuevo comentario</span><textarea value={body} onChange={event => setBody(event.target.value)} rows={3} maxLength={2000} placeholder="Escribe una decisión, una duda o menciona a alguien…" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-olive focus:ring-2 focus:ring-olive/15" /></label>{members.filter(member => member.user_id !== user?.id).length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-stone-400">Mencionar:</span>{members.filter(member => member.user_id !== user?.id).map(member => <button key={member.user_id} type="button" onClick={() => mention(member.email)} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-200">@{member.email}</button>)}</div>}<div className="flex justify-end"><Button type="submit" size="sm" disabled={busy || !body.trim()}><Send size={15} />{busy ? 'Publicando…' : 'Publicar'}</Button></div></form>
        <div className="space-y-2">{comments.length === 0 ? <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-400">Todavía no hay comentarios.</p> : comments.map(comment => <article key={comment.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-stone-500">{comment.author_email}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">{comment.body}</p><p className="mt-2 text-[0.68rem] text-stone-400">{new Date(comment.created_at).toLocaleString('es-ES')}</p></div>{(comment.author_id === user?.id || context?.role === 'owner') && <button type="button" onClick={() => remove(comment.id)} className="rounded-lg p-2 text-stone-300 hover:bg-red-50 hover:text-red-500" title="Eliminar comentario"><Trash2 size={15} /></button>}</div></article>)}</div>
      </div>
      <aside className="h-fit rounded-2xl bg-stone-900 p-4 text-white"><div className="flex items-center gap-2 text-sm font-semibold"><Bell size={16} /> Avisos por email</div><label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-white/70"><input type="checkbox" className="mt-0.5 accent-[#d86d4d]" checked={preferences.email_mentions} onChange={event => changePreference('email_mentions', event.target.checked)} /> Cuando me mencionen</label><label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-white/70"><input type="checkbox" className="mt-0.5 accent-[#d86d4d]" checked={preferences.email_comments} onChange={event => changePreference('email_comments', event.target.checked)} /> Con cada comentario</label></aside>
    </div>
  </section>
}
