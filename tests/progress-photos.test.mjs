import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterProgressPhotos, storageObjectPath } from '../src/utils/progressPhotos.js'

test('progress photos filter by room, phase and text', () => {
  const photos = [
    { title: 'Pared original', notes: '', phase: 'Antes', room_id: 'salon', rooms: { name: 'Salón' } },
    { title: 'Nueva ducha', notes: 'alicatado terminado', phase: 'Después', room_id: 'bano', rooms: { name: 'Baño' } },
  ]
  assert.deepEqual(filterProgressPhotos(photos, { search: 'alicatado', phase: 'Después', room_id: 'bano' }).map(photo => photo.title), ['Nueva ducha'])
})

test('storage path is extracted only from public images objects', () => {
  assert.equal(storageObjectPath('https://api.example.com/storage/v1/object/public/images/inspirations/a%20b.jpg'), 'inspirations/a b.jpg')
  assert.equal(storageObjectPath('https://shop.example/image.jpg'), null)
  assert.equal(storageObjectPath('invalid'), null)
})
