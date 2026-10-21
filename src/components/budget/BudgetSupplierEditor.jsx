import { matchingBudgetSuppliers } from '../../utils/budgetSupplier'

export default function BudgetSupplierEditor({ suppliers, draft, enabled, selectedId, onChange, onEnabled, onSelect }) {
  const matches = matchingBudgetSuppliers(suppliers, draft)
  return <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3" aria-label="Proveedor del presupuesto">
    <h3 className="text-sm font-semibold text-stone-800">Proveedor del presupuesto</h3>
    {selectedId ? <p className="text-xs text-olive">Se vinculará al proveedor seleccionado. Su ficha no se modificará.</p> : <label className="flex items-start gap-2 text-sm text-stone-700"><input type="checkbox" checked={enabled} onChange={event => onEnabled(event.target.checked)} className="mt-1 h-4 w-4 accent-olive" />Crear proveedor con estos datos al guardar el presupuesto</label>}
    {!selectedId && enabled && <>
      <p className="text-xs leading-relaxed text-stone-600">Revisa los datos del emisor en el documento. Deja vacíos los que no aparezcan. Se dará de alta como candidato y por contactar.</p>
      <div className="grid gap-3 sm:grid-cols-2">{[['name', 'Nombre del nuevo proveedor', 'text', 200], ['tax_id', 'NIF/CIF del proveedor', 'text', 40], ['phone', 'Teléfono del proveedor', 'tel', 80], ['email', 'Correo del proveedor', 'email', 200], ['address', 'Dirección del proveedor', 'text', 500]].map(([key, label, type, max]) => <label key={key} className={`block text-sm ${key === 'address' ? 'sm:col-span-2' : ''}`}>{label}<input type={type} maxLength={max} required={key === 'name'} value={draft[key]} onChange={event => onChange(key, event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" /></label>)}</div>
      {matches.length > 0 && <div role="status" className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><p>{matches.length === 1 ? 'Ya hay un proveedor coincidente. Puedes vincularlo; si guardas con estos datos se reutilizará su ficha.' : 'Hay varios proveedores coincidentes. Elige uno antes de guardar.'}</p>{matches.map(item => <button type="button" key={item.id} onClick={() => onSelect(item.id)} className="block min-h-10 text-left font-semibold underline">Vincular {item.name}{item.tax_id ? ` · ${item.tax_id}` : ''}{item.status === 'Archivado' ? ' · Archivado' : ''}</button>)}</div>}
    </>}
  </section>
}
