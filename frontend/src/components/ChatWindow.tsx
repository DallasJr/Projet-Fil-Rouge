import { useEffect, useRef, useState } from 'react'
import { Send, X, MessageSquare } from 'lucide-react'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { getOrderMessages } from '../api/orders.api'
import type { Message } from '../api/orders.api'

interface ChatWindowProps {
  orderId: string
  onClose?: () => void
}

export const ChatWindow = ({ orderId, onClose }: ChatWindowProps) => {
  const { socket, isConnected } = useSocket()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll automatique au bas du chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Charger l'historique et configurer les écoutes socket
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
      // Rejoindre le salon de la commande
      socket.emit('join_order', orderId)

      // Écouter les nouveaux messages
      socket.on('receive_message', (message: Message) => {
        if (message.orderId === orderId) {
          setMessages((prev) => {
            // Éviter les doublons
            if (prev.some((m) => m.id === message.id)) return prev
            return [...prev, message]
          })
        }
      })
    }

    return () => {
      active = false
      if (socket && isConnected) {
        socket.emit('leave_order', orderId)
        socket.off('receive_message')
      }
    }
  }, [orderId, socket, isConnected])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !socket || !isConnected || !user) return

    // Émettre le message au serveur Socket
    socket.emit('send_message', {
      orderId,
      content: inputValue
    })

    setInputValue('')
  }

  return (
    <div className="chat-window card">
      <div className="chat-header">
        <div className="chat-title">
          <MessageSquare size={16} className="text-primary" />
          <span>Messagerie en direct</span>
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} title={isConnected ? 'Connecté' : 'Hors ligne'}></span>
        </div>
        {onClose && (
          <button className="chat-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className="chat-messages">
        {isLoading ? (
          <div className="chat-loading">
            <div className="loading-spinner-sm"></div>
            <span>Chargement des messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <p>Aucun message. Entamez la discussion pour coordonner la livraison !</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id
            return (
              <div key={msg.id} className={`chat-bubble-container ${isMe ? 'me' : 'other'}`}>
                {!isMe && (
                  <span className="chat-bubble-sender">
                    {msg.sender.name} <span className="sender-role-tag">{msg.sender.role}</span>
                  </span>
                )}
                <div className={`chat-bubble ${isMe ? 'me' : 'other'}`}>
                  <p>{msg.content}</p>
                  <span className="chat-bubble-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          className="chat-input"
          placeholder={isConnected ? "Écrivez votre message..." : "Connexion au chat impossible..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={!isConnected}
        />
        <button type="submit" className="btn btn-primary chat-send-btn" disabled={!inputValue.trim() || !isConnected}>
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}
