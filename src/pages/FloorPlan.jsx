import { useState, useEffect, useRef } from 'react'
import {
  getFloorPlans,
  createFloorPlan,
  deleteFloorPlan,
  uploadFile,
} from '../services/floorplanService'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  ImageOff,
  X,
} from 'lucide-react'

export default function FloorPlan() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [viewImage, setViewImage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fileRef = useRef(null)

  async function loadPlans() {
    setLoading(true)
    try {
      const data = await getFloorPlans()
      setPlans(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPlans() }, [])

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadFile(file)
      const name = file.name.replace(/\.[^/.]+$/, '')
      await createFloorPlan({ name, image_url: result.url })
      await loadPlans()
      setModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(plan) {
    setConfirmDelete(plan)
  }

  async function confirmDeletePlan() {
    if (!confirmDelete) return
    try {
      await deleteFloorPlan(confirmDelete.id)
      setConfirmDelete(null)
      await loadPlans()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Planos</h1>
          <p className="mt-1 text-sm text-stone-500">
            {plans.length} planos
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={16} />
          Añadir plano
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <ImageOff size={48} className="mx-auto mb-4 text-stone-300" />
          <h2 className="text-lg font-semibold text-stone-700">No hay planos</h2>
          <p className="mt-1 text-sm text-stone-500">
            Sube el plano de tu vivienda para tenerlo siempre a mano
          </p>
          <Button className="mt-4" onClick={() => setModalOpen(true)}>
            <Upload size={16} />
            Subir plano
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:shadow-md"
            >
              <button
                onClick={() => setViewImage(plan)}
                className="block w-full text-left"
              >
                <div className="aspect-[4/3] bg-stone-100">
                  {plan.image_url ? (
                    <img
                      src={plan.image_url}
                      alt={plan.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageOff size={32} className="text-stone-300" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-semibold text-stone-800">{plan.name}</h3>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {new Date(plan.updated_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(plan)
                    }}
                    className="rounded-lg p-1.5 text-stone-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Subir plano"
      >
        <div
          className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-10 transition-colors hover:border-stone-400"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 size={32} className="animate-spin text-stone-400" />
          ) : (
            <>
              <Upload size={32} className="text-stone-400" />
              <p className="text-sm text-stone-500">
                Haz clic para seleccionar una imagen
              </p>
              <p className="text-xs text-stone-400">
                PNG, JPG, WEBP (máx 5 MB)
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
              e.target.value = ''
            }}
            disabled={uploading}
          />
        </div>
      </Modal>

      {/* Full image view */}
      {viewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setViewImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
              <h3 className="font-semibold text-stone-800">{viewImage.name}</h3>
              <button
                onClick={() => setViewImage(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X size={18} />
              </button>
            </div>
            {viewImage.image_url && (
              <img
                src={viewImage.image_url}
                alt={viewImage.name}
                className="max-h-[80vh] w-auto object-contain"
              />
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar plano"
        message={`¿Eliminar "${confirmDelete?.name}"?`}
        onConfirm={confirmDeletePlan}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
