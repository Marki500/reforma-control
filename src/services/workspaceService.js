import { supabase } from './supabaseClient'
import { storagePathForBucket } from './storageCleanup'

let contextPromise

export function clearWorkspaceCache() {
  contextPromise = undefined
}

export async function getWorkspaceContext({ fresh = false } = {}) {
  if (fresh) clearWorkspaceCache()
  if (!contextPromise) {
    contextPromise = supabase.rpc('get_workspace_context').then(({ data, error }) => {
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      if (!row?.workspace_owner_id) throw new Error('No se pudo identificar el proyecto compartido.')
      return row
    }).catch(error => {
      contextPromise = undefined
      throw error
    })
  }
  return contextPromise
}

export async function getCurrentProjectId() {
  return (await getWorkspaceContext()).project_id
}

export async function getUserProjects() { const { data, error } = await supabase.rpc('list_user_projects_v2'); if (error) throw error; return data || [] }
export async function switchProject(projectId) { const { error } = await supabase.rpc('switch_project', { p_project_id: projectId }); if (error) throw error; clearWorkspaceCache() }

export async function createProject(name) {
  const { data, error } = await supabase.rpc('create_project', { p_name: name.trim() })
  if (error) throw error
  clearWorkspaceCache()
  return data
}

export async function updateProject(projectId, name) {
  const { error } = await supabase.rpc('update_project', {
    p_project_id: projectId,
    p_name: name.trim(),
  })
  if (error) throw error
  clearWorkspaceCache()
}

export async function getProjectDetails() {
  const { data, error } = await supabase.rpc('get_project_details')
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function updateProjectDetails(details) {
  const { error } = await supabase.rpc('update_project_details', {
    p_name: details.name.trim(),
    p_description: details.description?.trim() || '',
    p_address: details.address?.trim() || '',
    p_status: details.status || 'planning',
    p_start_date: details.start_date || null,
    p_target_end_date: details.target_end_date || null,
    p_estimated_budget: details.estimated_budget === '' ? null : details.estimated_budget,
    p_setup_completed: true,
  })
  if (error) throw error
  clearWorkspaceCache()
}

export async function duplicateProject(projectId, name) {
  const { data, error } = await supabase.rpc('duplicate_project', { p_project_id: projectId, p_name: name.trim() })
  if (error) throw error
  clearWorkspaceCache()
  return data
}

export async function archiveProject(projectId) {
  const { error } = await supabase.rpc('archive_project', { p_project_id: projectId })
  if (error) throw error
  clearWorkspaceCache()
}

export async function restoreProject(projectId) {
  const { error } = await supabase.rpc('restore_project', { p_project_id: projectId })
  if (error) throw error
  clearWorkspaceCache()
}

async function removeProjectFiles() {
  const sources = [
    ['materials', 'main_image_url', 'material-images'],
    ['inspirations', 'image_url', 'images'],
    ['floor_plans', 'image_url', 'images'],
    ['budget_pdfs', 'file_url', 'budget-pdfs'],
    ['progress_photos', 'image_url', 'images'],
    ['home_documents', 'file_url', 'home-documents'],
  ]
  for (const [table, column, bucket] of sources) {
    const { data, error } = await supabase.from(table).select(column)
    if (error) throw error
    const paths = [...new Set((data || []).map(row => storagePathForBucket(row[column], bucket)).filter(Boolean))]
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(bucket).remove(paths)
      if (storageError) throw storageError
    }
  }
}

export async function deleteProject(projectId) {
  await removeProjectFiles()
  const { error } = await supabase.rpc('delete_project', { p_project_id: projectId })
  if (error) throw error
  clearWorkspaceCache()
}

export async function getProjectActivity(limit = 30) {
  const { data, error } = await supabase.rpc('list_project_activity', { p_limit: limit })
  if (error) throw error
  return data || []
}

export async function getProjectComments(limit = 50) { const { data, error } = await supabase.rpc('list_project_comments', { p_limit: limit }); if (error) throw error; return data || [] }
export async function createProjectComment(body) { const { data, error } = await supabase.rpc('create_project_comment', { p_body: body.trim() }); if (error) throw error; return data }
export async function deleteProjectComment(id) { const { error } = await supabase.rpc('delete_project_comment', { p_comment_id: id }); if (error) throw error }
export async function getProjectNotificationPreferences() { const { data, error } = await supabase.rpc('get_project_notification_preferences'); if (error) throw error; return (Array.isArray(data) ? data[0] : data) || { email_comments: false, email_mentions: true } }
export async function updateProjectNotificationPreferences(preferences) { const { error } = await supabase.rpc('update_project_notification_preferences', { p_email_comments: preferences.email_comments, p_email_mentions: preferences.email_mentions }); if (error) throw error }

export async function getWorkspaceMembers() {
  const { data, error } = await supabase.rpc('list_workspace_members')
  if (error) throw error
  return data || []
}

export async function getWorkspaceInvitations() {
  const { data, error } = await supabase.rpc('list_workspace_invitations')
  if (error) throw error
  return data || []
}

export async function createWorkspaceInvitation(email, role = 'editor') {
  const { data, error } = await supabase.rpc('create_workspace_invitation', { p_email: email.trim(), p_role: role })
  if (error) throw error
  return data
}

export async function acceptWorkspaceInvitation(token) {
  const { data, error } = await supabase.rpc('accept_workspace_invitation', { p_token: token })
  if (error) throw error
  clearWorkspaceCache()
  return data
}

export async function cancelWorkspaceInvitation(id) {
  const { error } = await supabase.from('project_invitations').delete().eq('id', id)
  if (error) throw error
}

export async function removeWorkspaceMember(userId) {
  const { error } = await supabase.rpc('remove_workspace_member', { p_user_id: userId })
  if (error) throw error
}

export async function updateWorkspaceMemberRole(userId, role) {
  const { error } = await supabase.rpc('update_project_member_role', { p_user_id: userId, p_role: role })
  if (error) throw error
}
