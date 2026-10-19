import { supabase } from './supabaseClient'
import { getProjectDetails, getWorkspaceContext } from './workspaceService'
import { buildReformReport, readReportRows } from '../utils/reformReport'

export async function loadReformReport() {
  const context = await getWorkspaceContext({ fresh: true })
  const projectId = context.project_id
  if (!projectId) throw new Error('Selecciona una reforma antes de exportar.')
  const [project, expenses, invoices, tasks] = await Promise.all([
    getProjectDetails(),
    readReportRows(supabase, 'expenses', projectId, '*, rooms(name), suppliers(name)'),
    readReportRows(supabase, 'invoices', projectId, 'id, expense_id, invoice_number, total_amount'),
    readReportRows(supabase, 'tasks', projectId, 'id, status'),
  ])
  if (project?.project_id !== projectId || (await getWorkspaceContext({ fresh: true })).project_id !== projectId) throw new Error('La reforma activa ha cambiado durante la exportación. Vuelve a intentarlo.')
  return buildReformReport({ project, expenses, invoices, tasks })
}

function download(bytes, extension, projectId, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const link = document.createElement('a')
  link.href = url; link.download = `nivel-${projectId}-${new Date().toISOString().slice(0, 10)}.${extension}`
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export async function downloadExpensesExcel() {
  const [report, { createExpensesWorkbook }] = await Promise.all([loadReformReport(), import('../utils/reportExcel')])
  const workbook = await createExpensesWorkbook(report)
  download(await workbook.xlsx.writeBuffer(), 'xlsx', report.project.project_id, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export async function downloadReformPdf() {
  const [report, { createReformPdf }] = await Promise.all([loadReformReport(), import('../utils/reportPdf')])
  const document = createReformPdf(report)
  download(document.output('arraybuffer'), 'pdf', report.project.project_id, 'application/pdf')
}
