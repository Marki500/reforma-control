import { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Upload, Link, Loader2 } from 'lucide-react'

const statuses = [
  { value: 'Mirando', name: 'Mirando' },
  { value: 'Favorito', name: 'Favorito' },
  { value: 'Pendiente de decidir', name: 'Pendiente de decidir' },
  { value: 'Descartado', name: 'Descartado' },
  { value: 'Comprado', name: 'Comprado' },
  { value: 'Recibido', name: 'Recibido' },
  { value: 'Devuelto', name: 'Devuelto' },
]

const priorities = [
  { value: 'Baja', name: 'Baja' },
  { value: 'Media', name: 'Media' },
  { value: 'Alta', name: 'Alta' },
  { value: 'Urgente', name: 'Urgente' },
]

export default function MaterialForm({
  initial,
  categories,
  rooms,
  onSave,
  onCancel,
  saving,
}) {
  const [form, setForm] = useState({
    name: '',
    brand: '',
    model: '',
    category_id: '',
    room_id: '',
    price: '',
    quantity: 1,
    currency: 'EUR',
    store_name: '',
    product_url: '',
    main_image_url: '',
    description: '',
    measurements: '',
    technical_specs: '',
    status: 'Mirando',
    priority: 'Media',
    availability: '',
    notes: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        brand: initial.brand || '',
        model: initial.model || '',
        category_id: initial.category_id || '',
        room_id: initial.room_id || '',
        price: initial.price || '',
        quantity: initial.quantity ?? 1,
        currency: initial.currency || 'EUR',
        store_name: initial.store_name || '',
        product_url: initial.product_url || '',
        main_image_url: initial.main_image_url || '',
        description: initial.description || '',
        measurements: initial.measurements || '',
        technical_specs: initial.technical_specs || '',
        status: initial.status || 'Mirando',
        priority: initial.priority || 'Media',
        availability: initial.availability || '',
        notes: initial.notes || '',
      })
      if (initial.main_image_url) {
        setImagePreview(initial.main_image_url)
      }
    }
  }, [initial])

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const materialData = {
      ...form,
      price: form.price ? Number(form.price) : null,
      quantity: Math.max(1, parseInt(form.quantity) || 1),
    }
    await onSave(materialData, imageFile)
  }

  function handleUrlImport() {
    const url = form.product_url
    if (!url) return
    // Extract domain as a hint
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      if (!form.store_name) {
        handleChange('store_name', domain)
      }
    } catch {}
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Image upload */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">Imagen</label>
        <div
          className="relative flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 transition-colors hover:border-stone-400"
          onClick={() => document.getElementById('image-input')?.click()}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg object-cover" />
          ) : (
            <div className="text-center">
              <Upload size={24} className="mx-auto text-stone-400" />
              <p className="mt-2 text-sm text-stone-500">Haz clic para subir una imagen</p>
            </div>
          )}
          <input
            id="image-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Nombre *" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />
        <Input label="Marca" value={form.brand} onChange={(e) => handleChange('brand', e.target.value)} />
        <Input label="Modelo" value={form.model} onChange={(e) => handleChange('model', e.target.value)} />
        <Input label="Precio" type="number" step="0.01" min="0" value={form.price} onChange={(e) => handleChange('price', e.target.value)} />
        <Input label="Cantidad" type="number" min="1" value={form.quantity} onChange={(e) => handleChange('quantity', Math.max(1, parseInt(e.target.value) || 1))} />
        <Select
          label="Categoría"
          options={categories}
          placeholder="Seleccionar categoría"
          value={form.category_id}
          onChange={(e) => handleChange('category_id', e.target.value)}
        />
        <Select
          label="Estancia"
          options={rooms}
          placeholder="Seleccionar estancia"
          value={form.room_id}
          onChange={(e) => handleChange('room_id', e.target.value)}
        />
        <Input label="Tienda" value={form.store_name} onChange={(e) => handleChange('store_name', e.target.value)} />
        <div>
          <Input
            label="URL del producto"
            value={form.product_url}
            onChange={(e) => handleChange('product_url', e.target.value)}
          />
          <button
            type="button"
            onClick={handleUrlImport}
            className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
          >
            <Link size={12} />
            Extraer datos de la URL
          </button>
        </div>
        <Select
          label="Estado"
          options={statuses}
          value={form.status}
          onChange={(e) => handleChange('status', e.target.value)}
        />
        <Select
          label="Prioridad"
          options={priorities}
          value={form.priority}
          onChange={(e) => handleChange('priority', e.target.value)}
        />
      </div>

      <Input
        label="Medidas"
        value={form.measurements}
        onChange={(e) => handleChange('measurements', e.target.value)}
        placeholder="Ej: 60x120 cm"
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">Características técnicas</label>
        <textarea
          value={form.technical_specs}
          onChange={(e) => handleChange('technical_specs', e.target.value)}
          rows={4}
          placeholder="Ej: Material: porcelánico, Acabado: mate, Resistencia: alta"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-800 placeholder:text-stone-400 transition-all focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-800 placeholder:text-stone-400 transition-all focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">Notas internas</label>
        <textarea
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-800 placeholder:text-stone-400 transition-all focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar material'
          )}
        </Button>
      </div>
    </form>
  )
}
