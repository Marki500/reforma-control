import { useState } from 'react'
import { X, FileText, Download, ExternalLink } from 'lucide-react'

export default function BudgetPDFViewer({ pdf, onClose }) {
  const [loading, setLoading] = useState(true)

  if (!pdf) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={20} className="flex-shrink-0 text-terracotta" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-stone-800">
                {pdf.name}
              </h2>
              {pdf.material_categories?.name && (
                <p className="text-xs text-stone-500">
                  {pdf.material_categories.name}
                  {pdf.file_size ? ` · ${(pdf.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={pdf.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              title="Abrir en nueva pestaña"
            >
              <ExternalLink size={18} />
            </a>
            <a
              href={pdf.file_url}
              download={pdf.name}
              className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              title="Descargar"
            >
              <Download size={18} />
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative min-h-[70vh] bg-stone-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
            </div>
          )}
          <iframe
            src={pdf.file_url}
            className="h-[70vh] w-full"
            onLoad={() => setLoading(false)}
            title={pdf.name}
          />
        </div>
      </div>
    </div>
  )
}
