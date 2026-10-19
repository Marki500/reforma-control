import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deleteProjectSafely, retryProjectFileCleanup } from '../src/utils/projectDeletion.js'

function fakeClient({ rpcError = null, storageError = null, queueError = null } = {}) {
  const calls = []
  const queue = [{ id: 'file-1', bucket_id: 'images', object_name: 'deleted-project/photo.png' }]
  return { calls, queue,
    async rpc(name, params) { calls.push(['rpc', name, params]); return { error: rpcError } },
    from(table) {
      assert.equal(table, 'project_file_cleanup')
      return {
        async select() { calls.push(['queue']); return { data: [...queue] } },
        delete() { return { async eq(_, id) { calls.push(['ack', id]); if (!queueError) queue.splice(0); return { error: queueError } } } },
      }
    },
    storage: { from(bucket) { return { async remove(paths) { calls.push(['remove', bucket, paths]); return { error: storageError } } } } },
  }
}

test('a rejected project deletion never lists or deletes files', async () => {
  const error = new Error('Debes conservar una reforma activa')
  const client = fakeClient({ rpcError: error })
  await assert.rejects(deleteProjectSafely(client, 'project-1'), error)
  assert.deepEqual(client.calls, [['rpc', 'delete_project_safely', { p_project_id: 'project-1' }]])
})

test('files are removed only after the deletion commits and acknowledged afterwards', async () => {
  const client = fakeClient()
  assert.deepEqual(await deleteProjectSafely(client, 'project-1'), { pending: 0 })
  assert.deepEqual(client.calls.map(call => call[0]), ['rpc', 'queue', 'remove', 'ack'])
  assert.equal(client.queue.length, 0)
})

test('failed cleanup survives for retry without deleting the project a second time', async () => {
  const client = fakeClient({ storageError: new Error('offline') })
  assert.deepEqual(await deleteProjectSafely(client, 'project-1'), { pending: 1 })
  assert.equal(client.queue.length, 1)
  assert.equal(client.calls.some(call => call[0] === 'ack'), false)
  client.storage.from = () => ({ remove: async () => ({}) })
  assert.deepEqual(await retryProjectFileCleanup(client), { pending: 0 })
  assert.equal(client.calls.filter(call => call[0] === 'rpc').length, 1)
})

test('an acknowledgement failure keeps cleanup retryable', async () => {
  const client = fakeClient({ queueError: new Error('offline') })
  assert.deepEqual(await deleteProjectSafely(client, 'project-1'), { pending: 1 })
  assert.equal(client.queue.length, 1)
})

test('a network failure after commit reports pending cleanup rather than a failed deletion', async () => {
  const client = fakeClient()
  const error = new Error('Connection lost after commit')
  client.from = () => ({ select: async () => { throw error } })
  assert.deepEqual(await deleteProjectSafely(client, 'project-1'), { pending: null, error })
  assert.equal(client.calls.filter(call => call[0] === 'rpc').length, 1)
})
