import { useState } from 'react'
import { DatabaseBackup, Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '../ui/Button'
import { downloadBackup, downloadCsv } from '../../services/exportService'

export default function DataTools() {
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  async function run(key, action) { setBusy(key); setError(''); try { await action() } catch (err) { setError(err.message || 'No se pudo preparar la descarga.') } finally { setBusy('') } }
  return <section className="space-y-3"><div><h2 className="text-lg font-semibold text-stone-700">Datos y copias de seguridad</h2><p className="mt-1 text-sm text-stone-500">Guarda una copia completa o abre los datos principales en Excel.</p></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="grid gap-3 sm:grid-cols-3"><Button variant="secondary" disabled={Boolean(busy)} onClick={() => run('backup', downloadBackup)}><DatabaseBackup size={17} />{busy === 'backup' ? 'Preparando…' : 'Copia completa'}</Button><Button variant="secondary" disabled={Boolean(busy)} onClick={() => run('materials', () => downloadCsv('materials', 'nivel-materiales'))}><FileSpreadsheet size={17} />Materiales CSV</Button><Button variant="secondary" disabled={Boolean(busy)} onClick={() => run('expenses', () => downloadCsv('expenses', 'nivel-gastos'))}><Download size={17} />Gastos CSV</Button></div><p className="text-xs leading-relaxed text-stone-400">La copia JSON contiene tus registros. Los archivos adjuntos se conservan mediante sus enlaces y deben descargarse por separado.</p></section>
}
