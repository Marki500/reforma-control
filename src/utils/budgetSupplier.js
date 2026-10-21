export const emptyBudgetSupplier = { name: '', tax_id: '', phone: '', email: '', address: '' }
export const supplierNameKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const supplierTaxKey = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

export function budgetSupplierDraft(draft) {
  return { name: draft.supplier_name || '', tax_id: draft.supplier_tax_id || '', phone: draft.supplier_phone || '', email: draft.supplier_email || '', address: draft.supplier_address || '' }
}

export function matchingBudgetSuppliers(suppliers, draft) {
  const name = supplierNameKey(draft.name), tax = supplierTaxKey(draft.tax_id)
  const taxMatches = tax ? suppliers.filter(item => supplierTaxKey(item.tax_id) === tax) : []
  if (taxMatches.length) return taxMatches
  return name ? suppliers.filter(item => supplierNameKey(item.name) === name && !(tax && supplierTaxKey(item.tax_id) && supplierTaxKey(item.tax_id) !== tax)) : []
}

export function validateBudgetSupplier(draft) {
  if (!draft.name.trim() || !supplierNameKey(draft.name)) return 'Escribe el nombre del proveedor.'
  if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email.trim())) return 'Revisa el correo del proveedor o déjalo vacío si no aparece en el documento.'
  return ''
}
