import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterSuppliers } from '../src/utils/suppliers.js'

const suppliers = [
  { name: 'Luz SL', contact_person: 'Ana', phone: '600111222', email: 'ana@luz.es', trade: 'Electricidad', status: 'Activo', contacted: true, opinion: 'Muy puntual', notes: '' },
  { name: 'Reformas Norte', contact_person: 'Luis', phone: '', email: '', trade: 'Lampista', status: 'Candidato', contacted: false, opinion: '', notes: 'Presupuesto pendiente' },
]

test('supplier filters combine and search contact details', () => {
  assert.deepEqual(filterSuppliers(suppliers, { search: 'ana@', trade: 'Electricidad', status: 'Activo', contacted: 'true' }).map(item => item.name), ['Luz SL'])
  assert.deepEqual(filterSuppliers(suppliers, { search: 'presupuesto', trade: '', status: 'Candidato', contacted: 'false' }).map(item => item.name), ['Reformas Norte'])
  assert.deepEqual(filterSuppliers(suppliers, { search: 'puntual', trade: '', status: '', contacted: '' }).map(item => item.name), ['Luz SL'])
  assert.deepEqual(filterSuppliers(suppliers, { search: '', trade: 'Lampista', status: '', contacted: '' }).map(item => item.name), ['Reformas Norte'])
})
