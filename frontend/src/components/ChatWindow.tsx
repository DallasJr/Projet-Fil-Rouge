import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, X, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { getOrderMessages } from '../api/orders.api'
import type { Message } from '../api/orders.api'

interface ChatListItem {
  orderId: string
  label: string
  active: boolean
  interlocutorName?: string
  interlocutorRole?: string
  orderStatus?: string
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:    { label: 'En attente',     bg: 'rgba(245,158,11,0.15)',  color: '#d97706' },
  ACCEPTED:   { label: 'Acceptée',       bg: 'rgba(16,185,129,0.15)',  color: '#059669' },
  PREPARING:  { label: 'Préparation',    bg: 'rgba(14,165,233,0.15)',  color: '#0284c7' },
  READY:      { label: 'Prête',          bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
  DELIVERING: { label: 'En livraison',   bg: 'rgba(99,102,241,0.15)',  color: '#6366f1' },
  DELIVERED:  { label: 'Livrée',         bg: 'rgba(16,185,129,0.1)',   color: '#059669' },
  CANCELLED:  { label: 'Annulée',        bg: 'rgba(239,68,68,0.1)',    color: '#ef4444' },
}

interface ChatWindowProps {
  orderId: string
  onClose?: () => void
  isClosed?: boolean
  /** Nom de l'interlocuteur principal */
  interlocutorName?: string
  /** Rôle de l'interlocuteur (CLIENT | DELIVERER | ADMIN) */
  interlocutorRole?: string
  /** Liste de conversations disponibles pour naviguer */
  chatList?: ChatListItem[]
  /** Callback quand l'utilisateur change de conversation */
  onChatSelect?: (orderId: string) => void
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  CLIENT:   { label: 'Client',   color: '#0369a1', bg: '#e0f2fe', dot: '#0ea5e9' },
  DELIVERER:{ label: 'Livreur',  color: '#15803d', bg: '#dcfce7', dot: '#22c55e' },
  ADMIN:    { label: 'Admin',    color: '#7c3aed', bg: '#f3e8ff', dot: '#a855f7' },
}

export const ChatWindow = ({
  orderId,
  onClose,
  isClosed = false,
  interlocutorName,
  interlocutorRole,
  chatList,
  onChatSelect,
}: ChatWindowProps) => {
  const { socket, isConnected } = useSocket()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [typingUsers, setTypingUsers] = useState<{ userId: string; name: string }[]>([])
  const [showChatList, setShowChatList] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, typingUsers])

  useEffect(() => {
    let active = true

    const loadHistory = async () => {
      try {
        setIsLoading(true)
        const history = await getOrderMessages(orderId)
        if (active) setMessages(history)
      } catch (err) {
        console.error('Erreur chargement messages:', err)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadHistory()

    if (socket && isConnected) {
      socket.emit('join_order', orderId)

      socket.on('receive_message', (message: Message) => {
        if (message.orderId === orderId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev
            return [...prev, message]
          })
          setTypingUsers((prev) => prev.filter((u) => u.userId !== message.senderId))
        }
      })

      socket.on('user_typing', (data: { userId: string; name: string; orderId: string; isTyping: boolean }) => {
        if (data.orderId !== orderId || data.userId === user?.id) return
        setTypingUsers((prev) => {
          if (data.isTyping) {
            if (prev.some((u) => u.userId === data.userId)) return prev
            return [...prev, { userId: data.userId, name: data.name }]
          } else {
            return prev.filter((u) => u.userId !== data.userId)
          }
        })
      })
    }

    return () => {
      active = false
      if (socket && isConnected) {
        if (isTypingRef.current) socket.emit('typing', { orderId, isTyping: false })
        socket.emit('leave_order', orderId)
        socket.off('receive_message')
        socket.off('user_typing')
      }
    }
  }, [orderId, socket, isConnected, user?.id])

  const emitTyping = useCallback((isTyping: boolean) => {
    if (!socket || !isConnected || !user) return
    socket.emit('typing', { orderId, isTyping })
  }, [socket, isConnected, user, orderId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    if (val.trim() === '') {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
      isTypingRef.current = false
      emitTyping(false)
      return
    }
    if (!isTypingRef.current) {
      isTypingRef.current = true
      emitTyping(true)
    }
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !socket || !isConnected || !user) return
    socket.emit('send_message', { orderId, content: inputValue })
    setInputValue('')
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    isTypingRef.current = false
    emitTyping(false)
  }

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const interlocRole = ROLE_LABELS[interlocutorRole || '']
  const hasMultipleChats = chatList && chatList.length > 1

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '480px',
      borderRadius: '16px',
      overflow: 'hidden',
      background: 'var(--color-surface)',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#f8fafc',
        flexShrink: 0,
        gap: '10px',
      }}>
        {/* Left: interlocutor info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          {/* Avatar */}
          {interlocutorName ? (
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: interlocRole ? `linear-gradient(135deg, ${interlocRole.dot}, ${interlocRole.color})` : 'linear-gradient(135deg, #60a5fa, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '800', color: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              {interlocutorName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={16} style={{ color: '#60a5fa' }} />
            </div>
          )}

          {/* Name + role + status */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', display: 'block' }}>
                {interlocutorName || 'Chat en direct'}
              </span>
              {interlocRole && (
                <span style={{
                  fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '8px',
                  backgroundColor: interlocRole.bg, color: interlocRole.color,
                }}>
                  {interlocRole.label}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                backgroundColor: isConnected ? '#4ade80' : '#f87171',
                boxShadow: isConnected ? '0 0 5px #4ade80' : 'none',
                display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {isClosed ? 'Discussion fermée' : isConnected ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: chat navigation + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {hasMultipleChats && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowChatList(v => !v)}
                title="Changer de conversation"
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px',
                  padding: '6px 8px', cursor: 'pointer', color: '#cbd5e1', display: 'flex',
                  alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >
                {showChatList ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {chatList!.length} chats
              </button>

              {/* Dropdown list */}
              {showChatList && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 10,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: '12px', boxShadow: 'var(--shadow-lg)',
                  minWidth: '280px', overflow: 'hidden',
                  animation: 'fadeSlideIn 0.2s ease forwards',
                }}>
                  <div style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '700', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                    Conversations actives
                  </div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {chatList!.map((chat) => {
                      const chatInterlocRole = chat.interlocutorRole ? ROLE_LABELS[chat.interlocutorRole] : null
                      const orderStatusCfg = chat.orderStatus ? STATUS_LABELS[chat.orderStatus] : null
                      return (
                        <button
                          key={chat.orderId}
                          onClick={() => {
                            onChatSelect?.(chat.orderId)
                            setShowChatList(false)
                          }}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '4px',
                            width: '100%', padding: '12px', border: 'none', cursor: 'pointer',
                            textAlign: 'left', fontSize: '13px',
                            background: chat.active ? 'var(--color-primary-glow)' : 'transparent',
                            borderBottom: '1px solid var(--color-border)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { if (!chat.active) e.currentTarget.style.background = 'var(--color-surface-2)' }}
                          onMouseLeave={(e) => { if (!chat.active) e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontWeight: '700', color: chat.active ? 'var(--color-primary)' : 'var(--color-text)', fontSize: '12.5px' }}>
                              #{chat.orderId.slice(-6).toUpperCase()}
                            </span>
                            {orderStatusCfg && (
                              <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', background: orderStatusCfg.bg, color: orderStatusCfg.color }}>
                                {orderStatusCfg.label}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                              {chat.interlocutorName || 'Support'}
                            </span>
                            {chatInterlocRole && (
                              <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '6px', background: chatInterlocRole.bg, color: chatInterlocRole.color, transform: 'scale(0.95)' }}>
                                {chatInterlocRole.label}
                              </span>
                            )}
                            {chat.active && <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px',
                padding: '6px', cursor: 'pointer', color: '#cbd5e1', display: 'flex',
                alignItems: 'center', transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, gap: '10px', color: '#64748b' }}>
            <div className="loading-spinner-sm" />
            <span style={{ fontSize: '13px' }}>Chargement des messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: '#94a3b8' }}>
            <MessageSquare size={28} style={{ opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '13px', textAlign: 'center' }}>
              Aucun message.<br />Commencez la discussion !
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.id
            const roleInfo = ROLE_LABELS[msg.sender.role] ?? { label: msg.sender.role, color: '#64748b', bg: '#f1f5f9', dot: '#94a3b8' }
            const prevMsg = messages[idx - 1]
            const showSender = !isMe && (idx === 0 || prevMsg?.senderId !== msg.senderId)

            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', animation: 'fadeSlideIn 0.25s ease forwards' }}>
                {showSender && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', marginLeft: '2px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: `linear-gradient(135deg, ${roleInfo.dot}, ${roleInfo.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: '#fff', flexShrink: 0 }}>
                      {msg.sender.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>{msg.sender.name}</span>
                    <span style={{ fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', backgroundColor: roleInfo.bg, color: roleInfo.color }}>
                      {roleInfo.label}
                    </span>
                  </div>
                )}
                <div style={{
                  maxWidth: '80%', padding: '9px 13px',
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  backgroundColor: isMe ? '#0284c7' : '#fff',
                  color: isMe ? '#fff' : '#1e293b',
                  boxShadow: isMe ? '0 2px 8px rgba(2,132,199,0.25)' : '0 1px 4px rgba(0,0,0,0.07)',
                  fontSize: '13px', lineHeight: '1.5',
                  border: isMe ? 'none' : '1px solid #e2e8f0',
                }}>
                  <p style={{ margin: 0, wordBreak: 'break-word' }}>{msg.content}</p>
                  <span style={{ display: 'block', textAlign: 'right', fontSize: '10px', marginTop: '4px', opacity: 0.65 }}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            )
          })
        )}

        {/* Indicateur de frappe */}
        {typingUsers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeSlideIn 0.2s ease forwards' }}>
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#94a3b8', display: 'inline-block', animation: `typingBounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
              <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                {typingUsers.map((u) => u.name).join(', ')} écrit{typingUsers.length > 1 ? 'ent' : ''}...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Templates rapides ── */}
      {!isClosed && isConnected && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '8px 12px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          {['Bonjour !', 'Où êtes-vous ?', 'Je descends dans 2 min', 'Bien reçu !', 'Merci beaucoup !'].map(txt => (
            <button
              key={txt}
              type="button"
              onClick={() => socket?.emit('send_message', { orderId, content: txt })}
              style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.color = '#0284c7'; e.currentTarget.style.background = '#e0f2fe' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#fff' }}
            >
              {txt}
            </button>
          ))}
        </div>
      )}

      {/* ── Zone de saisie ── */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', padding: '12px 14px', borderTop: '1px solid #e2e8f0', backgroundColor: '#fff', flexShrink: 0 }}>
        <input
          type="text"
          style={{ flex: 1, padding: '9px 14px', borderRadius: '20px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '13px', color: '#1e293b', transition: 'border-color 0.2s', backgroundColor: isClosed ? '#f8fafc' : '#fff' }}
          placeholder={isClosed ? 'Discussion fermée (commande terminée)' : isConnected ? 'Écrivez votre message...' : 'Connexion en cours...'}
          value={inputValue}
          onChange={handleInputChange}
          disabled={!isConnected || isClosed}
          onFocus={(e) => { e.target.style.borderColor = '#0284c7' }}
          onBlur={(e) => { e.target.style.borderColor = '#e2e8f0' }}
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || !isConnected || isClosed}
          style={{
            width: '38px', height: '38px', borderRadius: '50%', border: 'none', flexShrink: 0,
            backgroundColor: !inputValue.trim() || !isConnected || isClosed ? '#e2e8f0' : '#0284c7',
            color: !inputValue.trim() || !isConnected || isClosed ? '#94a3b8' : '#fff',
            cursor: !inputValue.trim() || !isConnected || isClosed ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.2s, transform 0.1s',
            boxShadow: inputValue.trim() && isConnected && !isClosed ? '0 2px 8px rgba(2,132,199,0.35)' : 'none',
          }}
          onMouseEnter={(e) => { if (inputValue.trim() && isConnected && !isClosed) e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <Send size={15} />
        </button>
      </form>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
