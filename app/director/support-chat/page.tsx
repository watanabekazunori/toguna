'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Bell,
  LogOut,
  Send,
  MessageCircle,
  AlertCircle,
} from 'lucide-react'

type SupportMessage = {
  id: string
  user_id: string
  message: string
  sender_type: 'user' | 'consultant' | 'system'
  attachments: string[]
  created_at: string
}

type Conversation = {
  date: string
  messages: SupportMessage[]
}

export default function SupportChatPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const QUICK_REPLIES = [
    'ありがとうございます',
    '確認いたします',
    '後ほどご連絡いたします',
  ]

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    fetchMessages()
    const subscription = supabase
      .channel('support_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as SupportMessage])
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(data || [])

      // Group messages by date
      const grouped: Record<string, SupportMessage[]> = {}
      ;(data || []).forEach((msg) => {
        const date = new Date(msg.created_at).toLocaleDateString('ja-JP')
        if (!grouped[date]) {
          grouped[date] = []
        }
        grouped[date].push(msg)
      })

      const convs = Object.entries(grouped).map(([date, msgs]) => ({
        date,
        messages: msgs,
      }))

      setConversations(convs)
      if (convs.length > 0) {
        setSelectedDate(convs[convs.length - 1].date)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return

    setSending(true)
    try {
      const { error } = await supabase.from('support_messages').insert([
        {
          user_id: user?.id,
          message: message,
          sender_type: 'user',
          attachments: [],
          created_at: new Date().toISOString(),
        },
      ])

      if (error) throw error

      setMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  const handleQuickReply = (text: string) => {
    setMessage(text)
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const getMessageBubbleClass = (senderType: string): string => {
    switch (senderType) {
      case 'user':
        return 'ml-auto bg-blue-500 text-white rounded-l-lg rounded-tr-lg'
      case 'consultant':
        return 'mr-auto bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-r-lg rounded-tl-lg'
      case 'system':
        return 'mx-auto bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg text-center'
      default:
        return ''
    }
  }

  if (authLoading || !isDirector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const selectedConversation = conversations.find(
    (c) => c.date === selectedDate
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/director">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                TOGUNA
              </h1>
            </Link>
            <Badge className="bg-purple-500 text-white px-4 py-1 text-sm font-medium">
              Director
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">{user?.name}</span>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {user?.name?.charAt(0) || 'D'}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 h-[calc(100vh-180px)] flex flex-col gap-4">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <Link href="/director">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <MessageCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                コンサルタントサポート
              </h2>
              <p className="text-sm text-slate-500">
                サポートチームとのメッセージ
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Conversation List */}
          <div className="w-64 flex flex-col gap-4">
            <Card className="flex-1 p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-y-auto flex flex-col">
              <h3 className="font-semibold text-sm mb-3">メッセージ</h3>
              {conversations.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  メッセージはありません
                </p>
              ) : (
                <div className="space-y-2 flex-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.date}
                      onClick={() => setSelectedDate(conv.date)}
                      className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                        selectedDate === conv.date
                          ? 'bg-blue-500 text-white'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <p className="font-medium text-xs mb-1">{conv.date}</p>
                      <p className="truncate text-xs opacity-75">
                        {conv.messages[conv.messages.length - 1]?.message}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Messages */}
            <Card className="flex-1 p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-y-auto flex flex-col">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : !selectedConversation || selectedConversation.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                  <MessageCircle className="h-12 w-12 opacity-30" />
                  <p>サポートチームにメッセージを送信してください</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 flex-1">
                    {selectedConversation.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.sender_type === 'system'
                            ? 'justify-center'
                            : msg.sender_type === 'user'
                              ? 'justify-end'
                              : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 ${getMessageBubbleClass(msg.sender_type)}`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString(
                              'ja-JP'
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div ref={messagesEndRef} />
                </>
              )}
            </Card>

            {/* Quick Replies */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium">
                クイック返信
              </p>
              <div className="flex gap-2">
                {QUICK_REPLIES.map((reply) => (
                  <Button
                    key={reply}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickReply(reply)}
                    className="text-xs"
                  >
                    {reply}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input Area */}
            <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleSendMessage()
                    }
                  }}
                  placeholder="メッセージを入力..."
                  className="resize-none"
                  rows={3}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !message.trim()}
                  className="bg-blue-600 text-white self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Ctrl + Enter で送信
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
