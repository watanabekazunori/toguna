// プロジェクト管理API - マルチプロジェクト構造の中核
import { createClient as createSupabaseClient } from './supabase/client'

const supabase = createSupabaseClient()

// ====== 型定義 ======

export type Project = {
  id: string
  client_id: string
  product_id?: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  priority: number
  daily_call_target: number
  weekly_appointment_target: number
  monthly_appointment_target: number
  min_appointment_rate: number
  withdrawal_threshold_days: number
  start_date?: string
  end_date?: string
  created_at: string
  updated_at: string
  // JOIN用
  client?: { id: string; name: string }
  product?: { id: string; name: string }
}

export type ProjectMember = {
  id: string
  project_id: string
  operator_id: string
  role: 'admin' | 'manager' | 'appointer'
  is_active: boolean
  assigned_at: string
  operator?: { id: string; name: string; email: string }
}

export type OperatorProjectAssignment = {
  id: string
  operator_id: string
  project_id: string
  slot_number: number
  is_active: boolean
  assigned_at: string
  project?: Project
}

export type ProjectStats = {
  project_id: string
  total_calls: number
  total_appointments: number
  appointment_rate: number
  today_calls: number
  today_appointments: number
  remaining_companies: number
  active_operators: number
}

// ====== プロジェクトCRUD ======

export async function getProjects(params?: {
  client_id?: string
  status?: string
}): Promise<Project[]> {
  let query = supabase
    .from('projects')
    .select('*, client:clients(id, name), product:products(id, name)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (params?.client_id) {
    query = query.eq('client_id', params.client_id)
  }
  if (params?.status) {
    query = query.eq('status', params.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch projects:', error)
    return []
  }
  return data || []
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, client:clients(id, name), product:products(id, name)')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch project:', error)
    return null
  }
  return data
}

export type CreateProjectInput = {
  client_id: string
  product_id?: string
  name: string
  description?: string
  daily_call_target?: number
  weekly_appointment_target?: number
  monthly_appointment_target?: number
  start_date?: string
  end_date?: string
}

export async function createProject(input: CreateProjectInput): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...input,
      status: 'active',
      priority: 0,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create project:', error)
    return null
  }
  return data
}

export async function updateProject(id: string, input: Partial<Project>): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update project:', error)
    return null
  }
  return data
}

export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete project:', error)
    return false
  }
  return true
}

// ====== プロジェクトメンバー管理 ======

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*, operator:operators(id, name, email)')
    .eq('project_id', projectId)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to fetch project members:', error)
    return []
  }
  return data || []
}

export async function addProjectMember(
  projectId: string,
  operatorId: string,
  role: 'admin' | 'manager' | 'appointer' = 'appointer'
): Promise<ProjectMember | null> {
  const { data, error } = await supabase
    .from('project_members')
    .upsert({
      project_id: projectId,
      operator_id: operatorId,
      role,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to add project member:', error)
    return null
  }
  return data
}

export async function removeProjectMember(projectId: string, operatorId: string): Promise<boolean> {
  const { error } = await supabase
    .from('project_members')
    .update({ is_active: false })
    .eq('project_id', projectId)
    .eq('operator_id', operatorId)

  if (error) {
    console.error('Failed to remove project member:', error)
    return false
  }
  return true
}

// ====== 6プロジェクト・スイッチング（オペレーターアサイン） ======

export async function getOperatorAssignments(operatorId: string): Promise<OperatorProjectAssignment[]> {
  const { data, error } = await supabase
    .from('operator_project_assignments')
    .select('*, project:projects(*, client:clients(id, name), product:products(id, name))')
    .eq('operator_id', operatorId)
    .eq('is_active', true)
    .order('slot_number', { ascending: true })

  if (error) {
    console.error('Failed to fetch operator assignments:', error)
    return []
  }
  return data || []
}

export async function assignOperatorToProject(
  operatorId: string,
  projectId: string,
  slotNumber: number
): Promise<OperatorProjectAssignment | null> {
  // 既存のスロットを無効化
  await supabase
    .from('operator_project_assignments')
    .update({ is_active: false })
    .eq('operator_id', operatorId)
    .eq('slot_number', slotNumber)

  const { data, error } = await supabase
    .from('operator_project_assignments')
    .insert({
      operator_id: operatorId,
      project_id: projectId,
      slot_number: slotNumber,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to assign operator to project:', error)
    return null
  }
  return data
}

export async function unassignOperatorFromSlot(
  operatorId: string,
  slotNumber: number
): Promise<boolean> {
  const { error } = await supabase
    .from('operator_project_assignments')
    .update({ is_active: false })
    .eq('operator_id', operatorId)
    .eq('slot_number', slotNumber)

  if (error) {
    console.error('Failed to unassign operator:', error)
    return false
  }
  return true
}

// ====== プロジェクト統計 ======

export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const today = new Date().toISOString().split('T')[0]

  const [callLogs, companies, members] = await Promise.all([
    supabase.from('call_logs').select('*').eq('project_id', projectId),
    supabase.from('companies').select('id, status').eq('project_id', projectId),
    supabase.from('project_members').select('id').eq('project_id', projectId).eq('is_active', true),
  ])

  const allLogs = callLogs.data || []
  const todayLogs = allLogs.filter(l => l.called_at?.startsWith(today))
  const totalAppointments = allLogs.filter(l => l.result === 'アポ獲得').length
  const todayAppointments = todayLogs.filter(l => l.result === 'アポ獲得').length
  const allCompanies = companies.data || []
  const remaining = allCompanies.filter(c => c.status !== '完了' && c.status !== 'NG').length

  return {
    project_id: projectId,
    total_calls: allLogs.length,
    total_appointments: totalAppointments,
    appointment_rate: allLogs.length > 0 ? (totalAppointments / allLogs.length) * 100 : 0,
    today_calls: todayLogs.length,
    today_appointments: todayAppointments,
    remaining_companies: remaining,
    active_operators: members.data?.length || 0,
  }
}

// ====== 複数プロジェクト一括統計 ======

export async function getMultiProjectStats(projectIds: string[]): Promise<Record<string, ProjectStats>> {
  const statsMap: Record<string, ProjectStats> = {}
  const results = await Promise.all(projectIds.map(id => getProjectStats(id)))
  results.forEach((stats, i) => {
    statsMap[projectIds[i]] = stats
  })
  return statsMap
}

// ====== バーチャル・セールスフロア ======

export type SalesFloorEntry = {
  id: string
  operator_id: string
  status: 'idle' | 'calling' | 'on_call' | 'wrapping_up' | 'break' | 'offline'
  current_company_id?: string
  current_project_id?: string
  call_start_time?: string
  appointments_today: number
  calls_today: number
  updated_at: string
  operator?: { id: string; name: string }
}

export async function getSalesFloorStatus(): Promise<SalesFloorEntry[]> {
  const { data, error } = await supabase
    .from('sales_floor_status')
    .select('*, operator:operators(id, name)')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch sales floor status:', error)
    return []
  }
  return data || []
}

export async function updateSalesFloorStatus(
  operatorId: string,
  updates: Partial<SalesFloorEntry>
): Promise<boolean> {
  const { error } = await supabase
    .from('sales_floor_status')
    .upsert({
      operator_id: operatorId,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'operator_id' })

  if (error) {
    console.error('Failed to update sales floor status:', error)
    return false
  }
  return true
}
