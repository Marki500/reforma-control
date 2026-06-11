import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getRooms, createRoom, updateRoom, deleteRoom,
} from '../services/materialsService'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'

const emptyItem = { name: '' }

export default function Settings() {
  const [categories, setCategories] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [type, setType] = useState('categories')
  const [form, setForm] = useState({ ...emptyItem })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [cats, rms] = await Promise.all([getCategories(), getRooms()])
      setCategories(cats)
      setRooms(rms)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function openAdd(t) {
    setType(t)
    setEditing(null)
    setForm({ ...emptyItem })
    setModalOpen(true)
  }

  function openEdit(t, item) {
    setType(t)
    setEditing(item)
    setForm({ name: item.name })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        if (type === 'categories') {
          await updateCategory(editing.id, form.name.trim())
        } else {
          await updateRoom(editing.id, form.name.trim())
        }
      } else {
        if (type === 'categories') {
          await createCategory(form.name.trim())
        } else {
          await createRoom(form.name.trim())
        }
      }
      setModalOpen(false)
      await loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(type, item) {
    const column = type === 'categories' ? 'category_id' : 'room_id'
    const { count } = await supabase
      .from('materials')
      .select('*', { count: 'exact', head: true })
      .eq(column, item.id)

    const msg = count > 0
      ? `"${item.name}" tiene ${count} material(es) asignado(s). Se quedarán sin categoría. ¿Eliminar de todas formas?`
      : `¿Eliminar "${item.name}"?`

    setConfirmDelete({ type, item, msg })
  }

  async function confirmDeleteAction() {
    if (!confirmDelete) return
    try {
      if (confirmDelete.type === 'categories') {
        await deleteCategory(confirmDelete.item.id)
      } else {
        await deleteRoom(confirmDelete.item.id)
      }
      setConfirmDelete(null)
      await loadData()
    } catch (err) {
      console.error(err)
    }
  }

  function renderList(type, items) {
    return (
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">Sin elementos</p>
        ) : (
          items.map((item) => {
            const isDefault = !item.user_id
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-700">{item.name}</span>
                  {isDefault && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-400">
                      por defecto
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(type, item)}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(type, item)}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Ajustes</h1>
        <p className="mt-1 text-sm text-stone-500">
          Gestiona las categorías y estancias disponibles en los filtros
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-700">Categorías</h2>
              <Button size="sm" onClick={() => openAdd('categories')}>
                <Plus size={15} />
                Añadir
              </Button>
            </div>
            {renderList('categories', categories)}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-700">Estancias</h2>
              <Button size="sm" onClick={() => openAdd('rooms')}>
                <Plus size={15} />
                Añadir
              </Button>
            </div>
            {renderList('rooms', rooms)}
          </section>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar' : 'Añadir'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={
              type === 'categories' ? 'Ej: Electricidad' : 'Ej: Garaje'
            }
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar"
        message={confirmDelete?.msg || ''}
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
