import { useState, useEffect, useRef } from 'react'
import { getNotes, createNote, updateNote, deleteNote } from '../services/notesService'
import { getRooms } from '../services/materialsService'
import { Button } from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import RichTextEditor from '../components/notes/RichTextEditor'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MessageSquare,
  LayoutDashboard,
} from 'lucide-react'

const categories = [
  { value: '', label: 'General' },
  { value: 'Resumen', label: 'Resumen proyecto' },
]

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [roomId, setRoomId] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function loadData() {
    setLoading(true)
    try {
      const [notesData, roomsData] = await Promise.all([getNotes(), getRooms()])
      setNotes(notesData)
      setRooms(roomsData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function startNew() {
    setEditingId(null)
    setShowForm(true)
    setContent('')
    setCategory('')
    setRoomId('')
  }

  function startEdit(note) {
    setEditingId(note.id)
    setShowForm(true)
    setContent(note.content)
    setCategory(note.category || '')
    setRoomId(note.room_id || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setShowForm(false)
    setContent('')
    setCategory('')
    setRoomId('')
  }

  async function handleSave() {
    const text = content.replace(/<[^>]*>/g, '').trim()
    if (!text) return
    setSaving(true)
    try {
      if (editingId) {
        await updateNote(editingId, { content, category: category || null, room_id: roomId || null })
      } else {
        await createNote({ content, category: category || null, room_id: roomId || null })
      }
      cancelEdit()
      await loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(note) {
    setConfirmDelete(note)
  }

  async function confirmDeleteNote() {
    if (!confirmDelete) return
    try {
      await deleteNote(confirmDelete.id)
      setConfirmDelete(null)
      await loadData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Notas</h1>
          <p className="mt-1 text-sm text-stone-500">
            {notes.length} notas
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={startNew}>
            <Plus size={16} />
            Añadir nota
          </Button>
        )}
      </div>

      {/* Editor */}
      {showForm && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Escribe una nota..."
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 outline-none focus:border-stone-400"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {category === 'Resumen' && (
              <span className="inline-flex items-center gap-1 text-xs text-olive">
                <LayoutDashboard size={12} />
                Aparecerá en el Dashboard
              </span>
            )}
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 outline-none focus:border-stone-400"
            >
              <option value="">Sin estancia</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {editingId !== null ? (
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Guardar
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Añadir
              </Button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </div>
      ) : notes.length === 0 && !showForm ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <MessageSquare size={48} className="mx-auto mb-4 text-stone-300" />
          <h2 className="text-lg font-semibold text-stone-700">No hay notas</h2>
          <p className="mt-1 text-sm text-stone-500">
            Apunta aquí todo lo importante de la obra
          </p>
          <Button className="mt-4" onClick={startNew}>
            <Plus size={16} />
            Primera nota
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group rounded-2xl bg-white p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="prose prose-stone prose-sm max-w-none">
                    {stripHtml(note.content) ? (
                      <div dangerouslySetInnerHTML={{ __html: note.content }} />
                    ) : (
                      <p className="text-stone-400 italic">(vacía)</p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {note.category && (
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        note.category === 'Resumen'
                          ? 'bg-olive-light text-olive'
                          : 'bg-stone-100 text-stone-500'
                      }`}>
                        {note.category === 'Resumen' && <LayoutDashboard size={10} className="inline mr-0.5" />}
                        {note.category}
                      </span>
                    )}
                    {note.rooms?.name && (
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                        {note.rooms.name}
                      </span>
                    )}
                    <span className="text-xs text-stone-400">
                      {new Date(note.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(note)}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(note)}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar nota"
        message="¿Eliminar esta nota?"
        onConfirm={confirmDeleteNote}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

function stripHtml(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html || ''
  return tmp.textContent.trim()
}
