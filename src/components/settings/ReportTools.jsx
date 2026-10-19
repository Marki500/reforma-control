import { useRef, useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '../ui/Button'
import { downloadExpensesExcel, downloadReformPdf } from '../../services/reformReportService'

export default function ReportTools() {
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const running = useRef(false)
  async function run(kind) {
    if (running.current) return
    running.current = true; setBusy(kind); setError(''); setNotice('')
    try {
      await (kind === 'excel' ? downloadExpensesExcel() : downloadReformPdf())
      setNotice('Informe preparado. La descarga se ha enviado a tu navegador.')
    } catch (err) { setError(err.message || 'No se pudo generar el informe. Vuelve a intentarlo.') }
    finally { running.current = false; setBusy('') }
  }
  return <section id="informes" className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
    <div><h2 className="text-lg font-semibold text-stone-800">Informes de la reforma</h2><p className="mt-1 text-sm text-stone-600">Exporta todos los gastos de la reforma activa o comparte un resumen de su situación.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><Button variant="secondary" disabled={Boolean(busy)} onClick={() => run('excel')}><FileSpreadsheet size={17} />{busy === 'excel' ? 'Preparando Excel…' : 'Gastos en Excel (.xlsx)'}</Button><Button variant="secondary" disabled={Boolean(busy)} onClick={() => run('pdf')}><FileText size={17} />{busy === 'pdf' ? 'Preparando PDF…' : 'Informe de reforma (.pdf)'}</Button></div>
    <p className="text-xs leading-relaxed text-stone-500">El PDF incluye presupuesto general, facturado, gastos, pagos, pendiente y avance de tareas. Las facturas vinculadas ya forman parte de los gastos. Los informes se generan en tu dispositivo y no incluyen los archivos adjuntos.</p>
    {busy && <p role="status" className="text-sm text-olive">Cargando todos los registros y preparando el archivo…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="text-sm text-olive">{notice}</p>}
  </section>
}
