// The database queues the file manifest and deletes the project in one transaction.
// Never attempt Storage removal until that transaction has committed.
export async function deleteProjectSafely(client, projectId) {
  const { error } = await client.rpc('delete_project_safely', { p_project_id: projectId })
  if (error) throw error
  return retryProjectFileCleanup(client)
}

export async function retryProjectFileCleanup(client) {
  let data
  try {
    const result = await client.from('project_file_cleanup').select('id, bucket_id, object_name')
    if (result.error) return { pending: null, error: result.error }
    data = result.data
  } catch (error) {
    return { pending: null, error }
  }
  let pending = 0
  for (const item of data || []) {
    try {
      const { error: storageError } = await client.storage.from(item.bucket_id).remove([item.object_name])
      if (storageError) throw storageError
      const { error: queueError } = await client.from('project_file_cleanup').delete().eq('id', item.id)
      if (queueError) throw queueError
    } catch {
      // Keep the durable queue entry; repeating Storage.remove is idempotent.
      pending += 1
    }
  }
  return { pending }
}
