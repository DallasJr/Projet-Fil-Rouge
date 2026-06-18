import React, { useState, useEffect, useRef } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { io, Socket } from 'socket.io-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../contexts/AuthContext'
import { getOrderMessages, Message } from '../api/orders'
import { API_BASE_URL } from '../api/client'

const SOCKET_URL = API_BASE_URL.replace('/api', '')

const getRoleColor = (role?: string) => {
  if (role === 'DELIVERER') return '#22c55e'
  if (role === 'ADMIN') return '#ef4444'
  return '#3b82f6'
}

const getRoleLabel = (role?: string) => {
  if (role === 'DELIVERER') return 'Livreur'
  if (role === 'ADMIN') return 'Admin'
  return 'Client'
}

export default function ChatScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation()
  const { user } = useAuth()
  const { orderId, interlocutorName, interlocutorRole } = route.params || {}

  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    let active = true

    const loadHistory = async () => {
      try {
        const history = await getOrderMessages(orderId)
        if (active) setMessages(history)
      } catch (err) {
        console.error('Error fetching chat history:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHistory()

    const setupSocket = async () => {
      const token = await AsyncStorage.getItem('token')
      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
      })

      socketRef.current = socket

      socket.on('connect', () => {
        setIsConnected(true)
        socket.emit('join_order', orderId)
      })

      socket.on('disconnect', () => setIsConnected(false))

      socket.on('receive_message', (message: Message) => {
        if (message.orderId === orderId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev
            return [...prev, message]
          })
        }
      })

      const interval = setInterval(async () => {
        if (!socket.connected) {
          try {
            const history = await getOrderMessages(orderId)
            if (active) setMessages(history)
          } catch {}
        }
      }, 5000)

      return () => {
        clearInterval(interval)
        socket.emit('leave_order', orderId)
        socket.disconnect()
      }
    }

    let cleanupSocket: (() => void) | undefined
    setupSocket().then((cleanup) => { cleanupSocket = cleanup })

    return () => {
      active = false
      if (cleanupSocket) cleanupSocket()
    }
  }, [orderId])

  const handleSend = () => {
    if (!inputValue.trim() || !socketRef.current) return
    socketRef.current.emit('send_message', { orderId, content: inputValue.trim() })
    setInputValue('')
  }

  const handleQuickSend = (text: string) => {
    if (!socketRef.current) return
    socketRef.current.emit('send_message', { orderId, content: text })
  }

  const roleColor = getRoleColor(interlocutorRole)
  const roleLabel = getRoleLabel(interlocutorRole)

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id
    const formattedTime = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    const initial = (item.sender?.name || '?').charAt(0).toUpperCase()

    return (
      <View style={[styles.messageWrapper, isMe ? styles.myWrapper : styles.theirWrapper]}>
        {/* Avatar for other person */}
        {!isMe && (
          <View style={[styles.avatar, { backgroundColor: roleColor + '22', borderColor: roleColor + '55' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>{initial}</Text>
          </View>
        )}

        <View style={styles.bubbleGroup}>
          {/* Sender name for others */}
          {!isMe && (
            <View style={styles.senderRow}>
              <Text style={styles.senderName}>{item.sender?.name}</Text>
              <View style={[styles.rolePill, { backgroundColor: roleColor + '22', borderColor: roleColor + '44' }]}>
                <Text style={[styles.rolePillText, { color: roleColor }]}>{roleLabel}</Text>
              </View>
            </View>
          )}

          {/* Bubble */}
          <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
            <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
              {item.content}
            </Text>
            <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
              {formattedTime}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const quickTemplates = ['Bonjour !', 'Où êtes-vous ?', 'Je descends dans 2 min', 'Bien reçu !', 'Merci !']

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {/* Avatar icon in header */}
          <View style={[styles.headerAvatar, { backgroundColor: roleColor + '22', borderColor: roleColor + '55' }]}>
            <Text style={[styles.headerAvatarText, { color: roleColor }]}>
              {(interlocutorName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{interlocutorName || 'Chat en direct'}</Text>
            <View style={styles.subtitleRow}>
              <View style={[styles.rolePill, { backgroundColor: roleColor + '22', borderColor: roleColor + '44' }]}>
                <Text style={[styles.rolePillText, { color: roleColor }]}>{roleLabel}</Text>
              </View>
              <Text style={styles.onlineStatus}>
                {isConnected ? '🟢 En ligne' : '⚪ Hors ligne'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ width: 60 }} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>Aucun message pour le moment.</Text>
              <Text style={styles.emptySubText}>Commencez la discussion !</Text>
            </View>
          }
        />
      )}

      {/* Quick replies */}
      <View style={styles.quickContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={quickTemplates}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.quickChip} onPress={() => handleQuickSend(item)}>
              <Text style={styles.quickChipText}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.quickList}
        />
      </View>

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Écrivez votre message..."
            placeholderTextColor="#94a3b8"
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleSend}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputValue.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputValue.trim()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backButton: { paddingVertical: 4 },
  backButtonText: { color: '#f97316', fontWeight: '800', fontSize: 14 },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontWeight: '900',
    fontSize: 15,
  },
  headerInfo: {
    alignItems: 'flex-start',
    gap: 2,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineStatus: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  rolePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  listContent: {
    padding: 16,
    paddingBottom: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 6,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    color: '#475569',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubText: {
    color: '#94a3b8',
    fontSize: 13,
  },

  // Message layout
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 14,
    maxWidth: '82%',
    gap: 8,
  },
  myWrapper: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  theirWrapper: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: '900',
    fontSize: 13,
  },
  bubbleGroup: {
    flex: 1,
    gap: 2,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
    marginBottom: 2,
  },
  senderName: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  myBubble: {
    backgroundColor: '#f97316',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myText: { color: '#ffffff' },
  theirText: { color: '#1e293b' },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTime: { color: 'rgba(255,255,255,0.65)' },
  theirTime: { color: '#94a3b8' },

  // Quick replies
  quickContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
  },
  quickList: { paddingHorizontal: 12, gap: 8 },
  quickChip: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },

  // Input bar
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#1e293b',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
})
