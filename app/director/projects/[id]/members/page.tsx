'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  assignOperatorToProject,
  unassignOperatorFromSlot,
  type ProjectMember,
  type OperatorProjectAssignment,
  getOperatorAssignments,
} from '@/lib/projects-api'
import { getOperators, type Operator } from '@/lib/supabase-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/auth-context'
import { ArrowLeft, Plus, Trash2, User } from 'lucide-react'

export default function ProjectMembersPage() {
  const params = useParams()
  const projectId = params.id as string
  const { user } = useAuth()

  const [members, setMembers] = useState<ProjectMember[]>([])
  const [assignments, setAssignments] = useState<OperatorProjectAssignment[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedOperatorId, setSelectedOperatorId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<number>(1)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    loadData()
  }, [projectId])

  async function loadData() {
    setLoading(true)
    try {
      const [membersData, operatorsData, assignmentsData] = await Promise.all([
        getProjectMembers(projectId),
        getOperators(),
        getOperatorAssignments(user?.id || ''),
      ])
      setMembers(membersData)
      setOperators(operatorsData)
      setAssignments(assignmentsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddMember() {
    if (!selectedOperatorId || !selectedSlot) return

    setAssigning(true)
    try {
      await assignOperatorToProject(selectedOperatorId, projectId, selectedSlot)
      await loadData()
      setDialogOpen(false)
      setSelectedOperatorId('')
      setSelectedSlot(1)
    } catch (error) {
      console.error('Failed to assign operator:', error)
    } finally {
      setAssigning(false)
    }
  }

  async function handleRemoveMember(operatorId: string, slot: number) {
    try {
      await unassignOperatorFromSlot(operatorId, slot)
      await loadData()
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
  }

  const slotAssignments = assignments.filter(a => a.project_id === projectId && a.is_active)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-4">
          <Link href={`/director/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">メンバー管理</h1>
            <p className="text-gray-500">プロジェクト内のオペレーター割り当てを管理</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : (
          <>
            {/* スロット割り当てセクション */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">オペレーター割り当て（6スロット）</CardTitle>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" />
                      オペレーター追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>オペレーターを追加</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">
                          オペレーター
                        </label>
                        <select
                          value={selectedOperatorId}
                          onChange={(e) => setSelectedOperatorId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">選択してください</option>
                          {operators.map((op) => (
                            <option key={op.id} value={op.id}>
                              {op.name} ({op.email})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">
                          スロット番号 (1-6)
                        </label>
                        <select
                          value={selectedSlot}
                          onChange={(e) => setSelectedSlot(parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {[1, 2, 3, 4, 5, 6].map((slot) => (
                            <option key={slot} value={slot}>
                              スロット {slot}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button
                        onClick={handleAddMember}
                        disabled={!selectedOperatorId || assigning}
                        className="w-full"
                      >
                        {assigning ? '追加中...' : '追加する'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {slotAssignments.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">
                    オペレーターが割り当てられていません
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {slotAssignments.map((assignment) => {
                      const operator = operators.find((op) => op.id === assignment.operator_id)
                      return (
                        <div
                          key={assignment.id}
                          className="p-4 bg-gradient-to-br from-blue-50 to-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                                {operator?.name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{operator?.name}</p>
                                <p className="text-sm text-gray-500">{operator?.email}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                              スロット {assignment.slot_number}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm mb-3">
                            <div className="flex justify-between text-gray-600">
                              <span>割り当て日時:</span>
                              <span className="font-medium">
                                {new Date(assignment.assigned_at).toLocaleDateString('ja-JP')}
                              </span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                              <span>ステータス:</span>
                              <Badge
                                variant={assignment.is_active ? 'default' : 'secondary'}
                                className="bg-green-100 text-green-700"
                              >
                                {assignment.is_active ? '稼働中' : '無効'}
                              </Badge>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveMember(assignment.operator_id, assignment.slot_number)
                            }
                            className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            削除
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* プロジェクトメンバー（マネージャーなど）セクション */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">プロジェクトメンバー</CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">メンバーが登録されていません</p>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-300 text-white rounded-full flex items-center justify-center font-semibold">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{member.operator?.name}</p>
                            <p className="text-sm text-gray-500">{member.operator?.email}</p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            member.role === 'admin'
                              ? 'default'
                              : member.role === 'manager'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {member.role === 'admin'
                            ? '管理者'
                            : member.role === 'manager'
                              ? 'マネージャー'
                              : 'アポインター'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
