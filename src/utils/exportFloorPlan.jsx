import { createElement } from 'react'
import { planBounds } from './floorPlan'
import PlanDrawing from '../components/floorplan/PlanDrawing'
import PlanDimensions from '../components/floorplan/PlanDimensions'

export async function floorPlanPng(plan, dimensions = true) {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const bounds = planBounds(plan), scale = 2400 / Math.max(bounds.width, bounds.height), width = Math.max(1, Math.round(bounds.width * scale)), height = Math.max(1, Math.round(bounds.height * scale))
  const svg = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width, height, viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`, style: { fontFamily: 'Arial, sans-serif' } }, createElement('rect', { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, fill: '#faf9f5' }), createElement(PlanDrawing, { plan, dimensions }), dimensions && createElement(PlanDimensions, { plan, allOpenings: true })))
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('No se pudo generar la imagen del plano.')); image.src = url })
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d'); if (!context) throw new Error('No se pudo crear la imagen en este navegador.')
    context.drawImage(image, 0, 0)
    return { dataUrl: canvas.toDataURL('image/png'), width, height }
  } finally { URL.revokeObjectURL(url) }
}

export async function exportFloorPlan(plan, name, format, dimensions) {
  const { dataUrl, width, height } = await floorPlanPng(plan, dimensions), filename = name.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'plano'
  if (format === 'png') {
    const link = document.createElement('a'); link.href = dataUrl; link.download = `${filename}.png`; link.click(); return
  }
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: width >= height ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight()
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text(pdf.splitTextToSize(`NIVEL · ${name}`, pageWidth - 24).slice(0, 2), 12, 14)
  const scale = Math.min((pageWidth - 24) / width, (pageHeight - 49) / height), w = width * scale, h = height * scale
  pdf.addImage(dataUrl, 'PNG', (pageWidth - w) / 2, 30 + (pageHeight - 49 - h) / 2, w, h)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(110)
  pdf.text('Medidas en metros · Cotas interiores aproximadas · Impresión sin escala fija', 12, pageHeight - 10)
  pdf.text(new Date().toLocaleDateString('es-ES'), pageWidth - 12, pageHeight - 10, { align: 'right' })
  pdf.save(`${filename}.pdf`)
}
