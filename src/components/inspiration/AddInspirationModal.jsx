import { useState, useRef, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { extractFromUrl, uploadImageFromUrl, uploadFile } from '../../services/inspirationsService'
import { Search, Loader2, ImageOff, Upload, ImageUp } from 'lucide-react'

export default function AddInspirationModal({
  open,
  onClose,
  onSave,
  rooms,
  editItem,
}) {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [roomId, setRoomId] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef()

  useEffect(() => {
    if (open && editItem) {
      setUrl(editItem.url || '')
      setTitle(editItem.title || '')
      setImageUrl(editItem.image_url || '')
      setRoomId(editItem.room_id || '')
      setMode(editItem.url ? 'url' : 'file')
    } else if (open) {
      setUrl('')
      setTitle('')
      setImageUrl('')
      setRoomId('')
      setMode('url')
    }
  }, [open, editItem])

  async function handleExtract() {
    if (!url.trim()) return
    setExtracting(true)
    setError('')
    try {
      const data = await extractFromUrl(url.trim())
      setTitle(data.title || '')
      setImageUrl(data.image_url || '')
    } catch (err) {
      setError(err.message || 'Error al extraer')
    } finally {
      setExtracting(false)
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setError('')
    try {
      const result = await uploadFile(file)
      setImageUrl(result.url)
    } catch (err) {
      setError(err.message || 'Error al subir archivo')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!url.trim() && !imageUrl) return
    setSaving(true)
    try {
      let finalImageUrl = imageUrl
      if (!editItem) {
        if (mode === 'url' && finalImageUrl && !finalImageUrl.startsWith('http')) {
          finalImageUrl = ''
        }
        if (mode === 'url' && finalImageUrl) {
          try {
            const uploaded = await uploadImageFromUrl(finalImageUrl)
            finalImageUrl = uploaded.url
          } catch {
            // fallback: keep original URL
          }
        }
      }
      await onSave({
        url: url.trim(),
        title: title.trim() || 'Sin título',
        image_url: finalImageUrl,
        room_id: roomId || null,
      })
      handleClose()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setMode('url')
    setUrl('')
    setTitle('')
    setImageUrl('')
    setRoomId('')
    setError('')
    onClose()
  }

  const canSave = mode === 'url' ? url.trim() : imageUrl

  return (
    <Modal open={open} onClose={handleClose} title={editItem ? 'Editar inspiración' : 'Nueva inspiración'}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${mode === 'url' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <Search size={14} className="inline" /> URL
          </button>
          <button
            type="button"
            onClick={() => setMode('file')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${mode === 'file' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <ImageUp size={14} className="inline" /> Subir
          </button>
        </div>

        {mode === 'url' ? (
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="URL de inspiración"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Pega un link de Pinterest, Instagram, Houzz..."
                autoFocus
              />
            </div>
            <div className="pt-6">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleExtract}
                disabled={extracting || !url.trim()}
                className="h-[42px]"
              >
                {extracting ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Imagen</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white py-8 text-stone-400 transition-colors hover:border-stone-400 hover:text-stone-500"
            >
              {extracting ? (
                <Loader2 size={28} className="animate-spin" />
              ) : (
                <>
                  <ImageUp size={28} className="mb-2" />
                  <p className="text-sm font-medium">Haz clic para seleccionar</p>
                  <p className="text-xs">PNG, JPG, WebP (máx 5MB)</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {imageUrl && (
          <div className="overflow-hidden rounded-xl bg-stone-100">
            <img
              src={imageUrl}
              alt="Preview"
              className="max-h-48 w-full object-contain"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
            <div className="hidden items-center justify-center py-8 text-stone-400">
              <ImageOff size={24} />
            </div>
          </div>
        )}

        <Input
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Baño terrazo verde"
        />

        <Select
          label="Estancia"
          options={rooms}
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Sin estancia"
        />

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !canSave}>
            {saving ? <><Upload size={16} className="animate-spin" /> Subiendo...</> : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
