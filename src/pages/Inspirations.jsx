import { useState, useEffect } from 'react'
import { getInspirations, createInspiration, updateInspiration, deleteInspiration } from '../services/inspirationsService'
import { getRooms } from '../services/materialsService'
import { Button } from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import AddInspirationModal from '../components/inspiration/AddInspirationModal'
import { Plus, Pencil, Trash2, ExternalLink, ImageOff } from 'lucide-react'

export default function Inspirations() {
  const [inspirations, setInspirations] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function loadData() {
    setLoading(true)
    try {
      const [insp, rms] = await Promise.all([getInspirations(), getRooms()])
      setInspirations(insp)
      setRooms(rms)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleSave(data) {
    if (editingItem) {
      await updateInspiration(editingItem.id, data)
    } else {
      await createInspiration(data)
    }
    setEditingItem(null)
    await loadData()
  }

  function handleEdit(item) {
    setEditingItem(item)
    setModalOpen(true)
  }

  async function handleDelete(id) {
    setConfirmDelete(id)
  }

  async function confirmDeleteInspiration() {
    if (!confirmDelete) return
    try {
      await deleteInspiration(confirmDelete)
      setConfirmDelete(null)
      await loadData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Inspiración</h1>
          <p className="mt-1 text-sm text-stone-500">
            Guarda ideas y referencias visuales para tu reforma
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} />
          Añadir
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </div>
      ) : inspirations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 py-20 text-stone-400">
          <ImageOff size={40} className="mb-3" />
          <p className="text-sm font-medium">Aún no tienes inspiraciones</p>
          <p className="mt-1 text-xs">Añade la URL de una imagen que te guste</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={15} />
            Añadir primera
          </Button>
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4">
          {inspirations.map((item) => (
            <div
              key={item.id}
              className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
                <div className="hidden items-center justify-center bg-stone-100 py-16 text-stone-300">
                  <ImageOff size={32} />
                </div>
              </div>

              <div className="space-y-1.5 p-3">
                <h3 className="text-sm font-medium text-stone-700 line-clamp-2">
                  {item.title}
                </h3>
                {item.rooms?.name && (
                  <span className="inline-block rounded-full bg-olive-light px-2 py-0.5 text-[10px] font-medium text-olive">
                    {item.rooms.name}
                  </span>
                )}
                <div className="flex items-center gap-2 pt-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
                  >
                    <ExternalLink size={12} />
                    Abrir original
                  </a>
                  <button
                    onClick={() => handleEdit(item)}
                    className="ml-auto rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddInspirationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null) }}
        onSave={handleSave}
        rooms={rooms}
        editItem={editingItem}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar inspiración"
        message="¿Eliminar esta inspiración?"
        onConfirm={confirmDeleteInspiration}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
