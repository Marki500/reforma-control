import { supabase } from './supabaseClient'

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

export async function getUserProjects() { const { data, error } = await supabase.rpc('list_user_projects'); if (error) throw error; return data || [] }
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
  const { error } = await supabase.from('workspace_invitations').delete().eq('id', id)
  if (error) throw error
}

export async function removeWorkspaceMember(userId) {
  const { error } = await supabase.rpc('remove_workspace_member', { p_user_id: userId })
  if (error) throw error
}
