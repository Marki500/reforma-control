import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Link, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

export default function ImportFromUrlModal({ open, onClose, onImport }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleExtract() {
    if (!url) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/import-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Error al importar')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message || 'No se pudo extraer información de la URL')
    } finally {
      setLoading(false)
    }
  }

  function handleUseData() {
    if (result) {
      onImport(result)
      handleReset()
    }
  }

  function handleManual() {
    let storeName = ''
    try {
      storeName = new URL(url).hostname.replace('www.', '')
    } catch {}
    onImport({ productUrl: url, storeName })
    handleReset()
  }

  function handleReset() {
    setUrl('')
    setResult(null)
    setError(null)
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar desde URL">
      <div className="space-y-4">
        <p className="text-sm text-stone-500">
          Pega la URL de un producto para extraer automáticamente sus datos.
        </p>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="https://www.tienda.com/producto..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleExtract}
            disabled={loading || !url}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Link size={16} />
            )}
            Extraer
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-700">Error</p>
              <p className="text-sm text-red-600">{error}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleExtract}
                  className="text-sm font-medium text-red-700 hover:underline"
                >
                  Reintentar
                </button>
                <button
                  onClick={handleManual}
                  className="text-sm font-medium text-stone-700 hover:underline"
                >
                  Continuar manualmente
                </button>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-xl bg-olive-light p-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-olive" />
              <p className="text-sm font-medium text-olive">Datos extraídos</p>
            </div>

            {result.name && (
              <p className="text-sm text-stone-700">
                <span className="font-medium">Nombre:</span> {result.name}
              </p>
            )}
            {result.brand && (
              <p className="text-sm text-stone-700">
                <span className="font-medium">Marca:</span> {result.brand}
              </p>
            )}
            {result.price && (
              <p className="text-sm text-stone-700">
                <span className="font-medium">Precio:</span> {result.price} {result.currency}
              </p>
            )}
            {result.storeName && (
              <p className="text-sm text-stone-700">
                <span className="font-medium">Tienda:</span> {result.storeName}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="olive" onClick={handleUseData}>
                Usar estos datos
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                Probar otra URL
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-stone-50 p-3">
          <p className="text-xs text-stone-500">
            La extracción puede no ser perfecta. Siempre podrás editar los datos antes de guardar.
          </p>
        </div>
      </div>
    </Modal>
  )
}
