import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Link, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { importProduct } from '../../services/productImportService'
import { normalizeProductUrl } from '../../utils/productUrl'
import { clipboardHtmlDetails, productFromClipboard } from '../../utils/productClipboard'

export default function ImportFromUrlModal({ open, onClose, onImport }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [storeBlocked, setStoreBlocked] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [pastedDetails, setPastedDetails] = useState({})
  const [diagnostic, setDiagnostic] = useState(null)
  const [diagnosticCopied, setDiagnosticCopied] = useState(false)

  function handleExtractPaste() {
    try {
      const data = productFromClipboard(pastedText, url, pastedDetails)
      setResult(data)
      setError(null)
      setStoreBlocked(false)
    } catch (err) {
      setError(err.message || 'Revisa la URL y el contenido pegado.')
    }
  }

  async function handleExtract() {
    if (!url) return
    const normalizedUrl = normalizeProductUrl(url)
    setUrl(normalizedUrl)
    setLoading(true)
    setError(null)
    setStoreBlocked(false)
    setResult(null)
    setDiagnostic(null)
    setDiagnosticCopied(false)

    try {
      const data = await importProduct(normalizedUrl, { onDiagnostic: setDiagnostic })
      setResult(data)
    } catch (err) {
      setError(err.message || 'No se pudo extraer información de la URL')
      setStoreBlocked(err.code === 'STORE_ACCESS_DENIED')
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
    const normalizedUrl = normalizeProductUrl(url)
    let storeName = ''
    try {
      storeName = new URL(normalizedUrl).hostname.replace('www.', '')
    } catch {}
    onImport({ productUrl: normalizedUrl, storeName })
    handleReset()
  }

  function handleReset() {
    setUrl('')
    setResult(null)
    setError(null)
    setStoreBlocked(false)
    setLoading(false)
    setPastedText('')
    setPastedDetails({})
    setDiagnostic(null)
    setDiagnosticCopied(false)
  }

  async function copyDiagnostic() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2))
      setDiagnosticCopied(true)
    } catch {
      setDiagnosticCopied(false)
    }
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

        {loading && <p role="status" className="text-sm text-stone-500">Consultando la tienda. Las fichas protegidas pueden tardar varios minutos.</p>}

        {error && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-700">Error</p>
              <p className="text-sm text-red-600">{error}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {storeBlocked ? (
                  <a
                    href={/^https?:\/\//i.test(normalizeProductUrl(url)) ? normalizeProductUrl(url) : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    Abrir ficha de la tienda
                  </a>
                ) : (
                  <button
                    onClick={handleExtract}
                    disabled={loading}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    Reintentar
                  </button>
                )}
                <button
                  onClick={handleManual}
                  className="rounded-lg bg-stone-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                >
                  Continuar manualmente
                </button>
              </div>
            </div>
          </div>
        )}

        {diagnostic && (
          <details className="rounded-xl border border-stone-200 p-3" open={error ? true : undefined}>
            <summary className="cursor-pointer text-sm font-medium text-stone-700">Diagnóstico de importación</summary>
            <p className="mt-2 text-xs text-stone-500">Incluye las etapas de lectura, los códigos HTTP y los identificadores para localizar el fallo.</p>
            <pre className="my-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-stone-50 p-3 text-xs text-stone-700">{JSON.stringify(diagnostic, null, 2)}</pre>
            <Button variant="secondary" onClick={copyDiagnostic}>{diagnosticCopied ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}</Button>
          </details>
        )}

        <details className="rounded-xl border border-stone-200 p-3" open={error ? true : undefined}>
          <summary className="cursor-pointer text-sm font-medium text-stone-700">Importar pegando texto o HTML</summary>
          <p className="mt-3 text-sm text-stone-500">
            Abre la ficha en la tienda, selecciona el nombre y el precio con IVA, cópialos y pégalos aquí. También puedes pegar su código HTML. Para incluir la foto, en la tienda haz clic derecho sobre la ficha,
            elige «Inspeccionar» y copia el contenedor que incluya la foto, el nombre y el precio con «Copiar → Copiar outerHTML».
            Mantén la URL del producto en el campo superior.
          </p>
          <label className="mt-3 block text-sm text-stone-700" htmlFor="product-clipboard">Contenido de la ficha (texto o HTML)</label>
          <textarea
            id="product-clipboard"
            className="mt-1 w-full rounded-lg border border-stone-300 p-3 text-sm"
            rows={5}
            value={pastedText}
            onChange={e => { setPastedText(e.target.value); setPastedDetails({}); setResult(null) }}
            onPaste={e => {
              const text = e.clipboardData.getData('text/plain')
              if (!text) return
              e.preventDefault()
              setPastedText(text)
              setPastedDetails(/<(?:div|html|body|h1|img|picture|section|meta|script)\b/i.test(text) ? {} : clipboardHtmlDetails(e.clipboardData.getData('text/html'), normalizeProductUrl(url)))
              setResult(null)
            }}
          />
          <p className="mb-3 text-xs text-stone-500">Revisa el resultado antes de guardar. La imagen se recupera si está incluida en la selección; los campos que falten se pueden completar después.</p>
          <Button variant="secondary" onClick={handleExtractPaste} disabled={loading || !url || !pastedText.trim()}>Extraer del contenido pegado</Button>
        </details>

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
            {result.price != null ? (
              <p className="text-sm text-stone-700">
                <span className="font-medium">Precio:</span> {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result.price)} {result.currency}
              </p>
            ) : <p className="text-sm text-amber-800">No se ha podido identificar el precio. Complétalo antes de guardar el material.</p>}
            {result.storeName && (
              <p className="text-sm text-stone-700">
                <span className="font-medium">Tienda:</span> {result.storeName}
              </p>
            )}

            {result.image && <img src={result.image} alt={result.name || 'Imagen del producto'} referrerPolicy="no-referrer" className="h-24 w-24 rounded-lg object-contain" />}

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
