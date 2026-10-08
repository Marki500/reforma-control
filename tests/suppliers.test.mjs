import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterSuppliers } from '../src/utils/suppliers.js'

const suppliers = [
  { name: 'Luz SL', contact_person: 'Ana', phone: '600111222', email: 'ana@luz.es', trade: 'Electricidad', status: 'Activo', notes: '' },
  { name: 'Reformas Norte', contact_person: 'Luis', phone: '', email: '', trade: 'Albañilería', status: 'Candidato', notes: 'Presupuesto pendiente' },
]

test('supplier filters combine and search contact details', () => {
  assert.deepEqual(filterSuppliers(suppliers, { search: 'ana@', trade: 'Electricidad', status: 'Activo' }).map(item => item.name), ['Luz SL'])
  assert.deepEqual(filterSuppliers(suppliers, { search: 'presupuesto', trade: '', status: 'Candidato' }).map(item => item.name), ['Reformas Norte'])
})
