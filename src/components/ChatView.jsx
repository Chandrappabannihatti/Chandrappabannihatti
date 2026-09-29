import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiMessageCircle,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiSmile,
  FiWifi,
  FiX,
} from 'react-icons/fi'
import { demoTeachers, markDemoMessageRead, upsertDemoMessage } from '../data/demo'
import api, { DEMO_MODE, getAuthToken, isApiToken } from '../lib/api'

const EMOJIS = ['🙂', '👍', '🎉', '📚', '✅', '🙏']

function contactKey(contact) {
  return `${String(contact.role || '').toLowerCase()}:${Number(contact.id)}`
}

function initials(name) {
  return String(name || 'User').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
}

function samePerson(message, id, role, prefix) {
  return Number(message[`${prefix}Id`] ?? message[`${prefix}_id`]) === Number(id)
    && String(message[`${prefix}Role`] ?? message[`${prefix}_role`] ?? '').toLowerCase() === String(role || '').toLowerCase()
}

function messageBelongsToContact(message, user, contact) {
  const sentByUser = samePerson(message, user.id, user.role, 'sender')
  const receivedByUser = samePerson(message, user.id, user.role, 'receiver')
  const sentByContact = samePerson(message, contact.id, contact.role, 'sender')
  const receivedByContact = samePerson(message, contact.id, contact.role, 'receiver')
  if ((sentByUser && receivedByContact) || (receivedByUser && sentByContact)) return true
  // Older demo rows without role-aware IDs are still shown only within the
  // linked learner scope, never as a cross-user conversation.
  if (!message.senderId && !message.receiverId && contact.role === 'teacher') return String(message.sender || '').toLowerCase().includes(String(contact.name || '').toLowerCase())
  return false
}

function messageTime(message) {
  const value = message.createdAt || message.created_at || message.time
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isNaN(date.getTime()) && (String(value).includes('T') || String(value).includes('-'))) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  return String(value).replace(/^Today,\s*/i, '')
}

function messageSortValue(message) {
  const value = message.createdAt || message.created_at
  const timestamp = value ? Date.parse(value) : Number(message.id) || 0
  return Number.isNaN(timestamp) ? Number(message.id) || 0 : timestamp
}

function localContacts(user, students, department, semester, section) {
  const contacts = []
  const add = (contact) => {
    if (!contact?.id || !contact?.role) return
    if (department && contact.department && contact.department !== department) return
    if (semester && contact.semester && Number(contact.semester) !== Number(semester)) return
    if (section && contact.section && String(contact.section).toUpperCase() !== String(section).toUpperCase()) return
    if (!contacts.some((item) => contactKey(item) === contactKey(contact))) contacts.push({ ...contact, initials: contact.initials || initials(contact.name), online: false })
  }
  if (user.role === 'student' || user.role === 'parent') {
    demoTeachers.filter((teacher) => !department || teacher.department === department).forEach((teacher) => add({
      ...teacher,
      role: 'teacher',
      relationship: 'Teacher',
      studentId: user.studentId || user.id,
      studentName: user.studentName || user.name,
      usn: user.usn,
      semester: user.semester,
      section,
    }))
  } else {
    students.forEach((student) => {
      add({ id: student.id, role: 'student', name: student.name, email: student.email, initials: student.initials, department: student.department, semester: student.semester, section: student.section, usn: student.usn, studentId: student.id, studentName: student.name, relationship: 'Student' })
      const parentId = student.parentId || student.parent_id || (Number(student.id) === 4 ? 2 : 10000 + Number(student.id))
      add({ id: parentId, role: 'parent', name: student.parentName || `${student.name} Parent`, email: student.parentEmail, initials: initials(student.parentName || `${student.name} Parent`), department: student.department, semester: student.semester, section: student.section, usn: student.usn, studentId: student.id, studentName: student.name, relationship: 'Parent' })
    })
  }
  return contacts
}

function mergeById(current, next) {
  if (!next?.id) return current
  const index = current.findIndex((item) => Number(item.id) === Number(next.id))
  if (index < 0) return [...current, next]
  return current.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item)
}

function StatusMark({ message, outgoing }) {
  if (!outgoing) return null
  if (message.status === 'read' || message.read) return <span className="chat-message-status read" title="Read"><FiCheckCircle /></span>
  if (message.status === 'delivered') return <span className="chat-message-status" title="Delivered"><FiCheck /><FiCheck /></span>
  return <span className="chat-message-status" title="Sent"><FiClock /></span>
}

function Avatar({ contact, small = false }) {
  return <span className={`chat-avatar ${small ? 'small' : ''} ${contact?.role === 'teacher' ? 'teacher' : contact?.role === 'parent' ? 'parent' : 'student'}`}>{contact?.initials || initials(contact?.name)}</span>
}

export default function ChatView({
  user,
  students = [],
  initialMessages = [],
  department = user.department === 'ALL' ? '' : user.department,
  semester = user.semester,
  section = '',
  apiSession = !DEMO_MODE && isApiToken(getAuthToken()),
  notify = () => {},
  onUnreadCountChange = () => {},
  title = 'Messages',
  description = 'Private, real-time conversations with the people supporting each learner.',
}) {
  const [contacts, setContacts] = useState(() => localContacts(user, students, department, semester, section))
  const [messages, setMessages] = useState(() => [...initialMessages])
  const [selectedKey, setSelectedKey] = useState('')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(null)
  const [connection, setConnection] = useState(apiSession ? 'connecting' : 'offline')
  const [error, setError] = useState('')
  const socketRef = useRef(null)
  const reconnectTimer = useRef(null)
  const typingTimer = useRef(null)
  const selectedKeyRef = useRef('')
  const contactsRef = useRef(contacts)
  const notifyRef = useRef(notify)
  const aliveRef = useRef(true)

  useEffect(() => { selectedKeyRef.current = selectedKey }, [selectedKey])
  useEffect(() => { contactsRef.current = contacts }, [contacts])
  useEffect(() => { notifyRef.current = notify }, [notify])

  const scopedParams = useMemo(() => ({
    ...(department ? { department } : {}),
    ...(semester ? { semester } : {}),
    ...(section ? { section } : {}),
  }), [department, semester, section])

  const loadChat = async () => {
    const fallbackContacts = localContacts(user, students, department, semester, section)
    if (!apiSession) {
      setContacts(fallbackContacts)
      setMessages(initialMessages.length ? initialMessages : [])
      return
    }
    setError('')
    try {
      const [contactResult, messageResult] = await Promise.all([
        api.getMessageContacts(scopedParams),
        api.getMessages(scopedParams),
      ])
      if (!aliveRef.current) return
      setContacts(contactResult?.data?.length ? contactResult.data : fallbackContacts)
      setMessages(messageResult?.data || initialMessages || [])
    } catch (loadError) {
      if (!aliveRef.current) return
      console.error('[chat] Conversation bootstrap failed.', { status: loadError.response?.status || 'network', message: loadError.response?.data?.message || loadError.message })
      setContacts(fallbackContacts)
      setMessages(initialMessages || [])
      setError(loadError.response?.data?.message || 'Live chat is temporarily unavailable. Showing the saved conversations.')
    }
  }

  useEffect(() => {
    aliveRef.current = true
    loadChat()
    return () => { aliveRef.current = false }
    // The caller changes this view when the authenticated scope changes.
  }, [user.id, user.role, department, semester, section, apiSession])

  useEffect(() => {
    if (!initialMessages?.length) return
    setMessages((current) => initialMessages.reduce((merged, item) => mergeById(merged, item), current))
  }, [initialMessages])

  useEffect(() => {
    if (!DEMO_MODE) return undefined
    const syncDemoMessage = (event) => {
      if (event.detail) setMessages((current) => mergeById(current, event.detail))
    }
    window.addEventListener('camps-messages-updated', syncDemoMessage)
    return () => window.removeEventListener('camps-messages-updated', syncDemoMessage)
  }, [])

  const contactSummaries = useMemo(() => {
    const withSummary = contacts.map((contact) => {
      const conversation = messages.filter((message) => messageBelongsToContact(message, user, contact)).sort((a, b) => messageSortValue(b) - messageSortValue(a))
      const latest = conversation[0]
      const unread = conversation.filter((message) => !message.read && message.status !== 'read' && !samePerson(message, user.id, user.role, 'sender')).length
      return { ...contact, latest, unread, conversation }
    })
    return withSummary.sort((a, b) => messageSortValue(b.latest || {}) - messageSortValue(a.latest || {}) || a.name.localeCompare(b.name))
  }, [contacts, messages, user])

  useEffect(() => {
    const totalUnread = contactSummaries.reduce((total, contact) => total + contact.unread, 0)
    onUnreadCountChange(totalUnread)
    if (!selectedKey && contactSummaries[0]) setSelectedKey(contactKey(contactSummaries[0]))
    if (selectedKey && !contactSummaries.some((contact) => contactKey(contact) === selectedKey)) setSelectedKey(contactSummaries[0] ? contactKey(contactSummaries[0]) : '')
  }, [contactSummaries, onUnreadCountChange, selectedKey])

  const selectedContact = contactSummaries.find((contact) => contactKey(contact) === selectedKey) || contactSummaries[0]
  const selectedMessages = selectedContact?.conversation?.slice().sort((a, b) => messageSortValue(a) - messageSortValue(b)) || []
  const visibleContacts = contactSummaries.filter((contact) => `${contact.name} ${contact.role} ${contact.usn || ''} ${contact.studentName || ''}`.toLowerCase().includes(search.toLowerCase()))

  const markRead = async (message) => {
    if (samePerson(message, user.id, user.role, 'receiver') && !message.read) {
      setMessages((current) => current.map((item) => Number(item.id) === Number(message.id) ? { ...item, read: true, readStatus: true, status: 'read' } : item))
      if (DEMO_MODE) markDemoMessageRead(message.id)
      if (apiSession) {
        try { await api.markMessageRead(message.id) } catch (readError) { console.warn('[chat] Read receipt failed.', { messageId: message.id, status: readError.response?.status || 'network' }) }
      }
    }
  }

  useEffect(() => {
    selectedMessages.forEach((message) => { if (!message.read && samePerson(message, user.id, user.role, 'receiver')) markRead(message) })
    // Read receipts are intentionally triggered by the active conversation.
  }, [selectedKey, messages.length])

  const websocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }

  useEffect(() => {
    if (!apiSession || DEMO_MODE) {
      setConnection('offline')
      return undefined
    }
    let stopped = false
    const connect = () => {
      if (stopped) return
      const socket = new window.WebSocket(websocketUrl())
      socketRef.current = socket
      socket.onopen = () => {
        setConnection('connecting')
        const token = getAuthToken()
        if (token) socket.send(JSON.stringify({ type: 'auth', token }))
      }
      socket.onmessage = (event) => {
        let packet
        try { packet = JSON.parse(event.data) } catch { return }
        if (packet.type === 'authenticated') { setConnection('live'); return }
        if (packet.type === 'presence') {
          const presence = packet.data
          setContacts((current) => current.map((contact) => contact.id === Number(presence.id) && contact.role === presence.role ? { ...contact, online: Boolean(presence.online) } : contact))
          return
        }
        if (packet.type === 'message:new' && packet.data) {
          setMessages((current) => mergeById(current, packet.data))
          setContacts((current) => current.map((contact) => messageBelongsToContact(packet.data, user, contact) ? { ...contact, online: contact.online } : contact))
          if (!samePerson(packet.data, user.id, user.role, 'sender')) {
            const senderName = packet.data.sender || packet.data.senderName || contactsRef.current.find((contact) => samePerson(packet.data, contact.id, contact.role, 'sender'))?.name || 'A contact'
            notifyRef.current(`New message from ${senderName}`)
            if (typeof window.Notification === 'function' && window.Notification.permission === 'granted') new window.Notification(`New message from ${senderName}`, { body: packet.data.body || 'Open CAMPS to read the message.' })
          }
          return
        }
        if (packet.type === 'message:status' && packet.data) {
          setMessages((current) => current.map((message) => Number(message.id) === Number(packet.data.id) ? { ...message, status: packet.data.status, read: packet.data.status === 'read' || message.read, readStatus: packet.data.status === 'read' || message.readStatus } : message))
          return
        }
        if (packet.type === 'typing' && packet.data) {
          const incoming = packet.data
          const key = `${incoming.senderRole}:${Number(incoming.senderId)}`
          if (incoming.recipientId === Number(user.id) && incoming.recipientRole === user.role) {
            setTyping(incoming.isTyping ? { key, name: incoming.senderName } : null)
            window.clearTimeout(typingTimer.current)
            if (incoming.isTyping) typingTimer.current = window.setTimeout(() => setTyping(null), 1800)
          }
        }
      }
      socket.onerror = () => setConnection('offline')
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null
        if (!stopped) {
          setConnection('offline')
          reconnectTimer.current = window.setTimeout(connect, 2500)
        }
      }
    }
    connect()
    return () => {
      stopped = true
      window.clearTimeout(reconnectTimer.current)
      socketRef.current?.close()
      socketRef.current = null
      window.clearTimeout(typingTimer.current)
    }
  }, [apiSession, user.id, user.role])

  const emitTyping = (isTyping) => {
    const contact = selectedContact
    if (!contact || socketRef.current?.readyState !== window.WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ type: 'typing', recipientId: contact.id, recipientRole: contact.role, studentId: contact.studentId, semester: contact.semester || semester || user.semester, section: contact.section || section || undefined, isTyping }))
    if (isTyping) {
      window.clearTimeout(typingTimer.current)
      typingTimer.current = window.setTimeout(() => emitTyping(false), 1100)
    }
  }

  const onDraftChange = (event) => {
    const value = event.target.value
    setDraft(value)
    if (value.trim()) emitTyping(true)
    else emitTyping(false)
  }

  const send = async (event) => {
    event?.preventDefault()
    const body = draft.trim()
    if (!body || !selectedContact || sending) return
    setSending(true)
    setError('')
    const studentId = selectedContact.studentId || user.studentId || (user.role === 'student' ? user.id : null)
    const payload = {
      recipientRole: selectedContact.role,
      recipientId: Number(selectedContact.id),
      studentId: studentId ? Number(studentId) : undefined,
      subject: selectedContact.latest?.subject || `Chat with ${selectedContact.name}`,
      body,
      department: selectedContact.department || department || user.department,
      semester: selectedContact.semester || semester || user.semester,
      section: selectedContact.section || section || undefined,
    }
    try {
      let saved
      if (apiSession) {
        const response = await api.sendMessage(payload)
        saved = response?.data
      } else {
        saved = { ...payload, id: `local-${Date.now()}`, senderId: user.id, senderRole: user.role, sender: user.name, receiverId: selectedContact.id, receiverRole: selectedContact.role, recipient: selectedContact.name, recipientId: selectedContact.id, recipientRole: selectedContact.role, studentId, studentName: selectedContact.studentName || user.studentName || user.name, department: payload.department, semester: payload.semester, section: payload.section, createdAt: new Date().toISOString(), time: 'Just now', status: 'sent', read: true, readStatus: true, initials: user.initials }
      }
      if (saved) {
        setMessages((current) => mergeById(current, saved))
        if (DEMO_MODE) upsertDemoMessage(saved)
        window.dispatchEvent(new window.CustomEvent('camps-messages-updated', { detail: saved }))
        setDraft('')
        setShowEmoji(false)
        emitTyping(false)
      }
    } catch (sendError) {
      console.error('[chat] Message send failed.', { status: sendError.response?.status || 'network', message: sendError.response?.data?.message || sendError.message })
      setError(sendError.response?.data?.message || 'Message could not be sent. Nothing was saved.')
      notify(sendError.response?.data?.message || 'Message could not be sent.')
    } finally { setSending(false) }
  }

  const selectContact = (contact) => {
    setSelectedKey(contactKey(contact))
    setTyping(null)
    setShowEmoji(false)
  }

  return <div className="dashboard-content chat-page">
    <div className="chat-page-heading"><div><p className="page-eyebrow">Private communication</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{description}</p></div><div className="chat-live-indicator"><span className={`chat-live-dot ${connection}`} />{connection === 'live' ? 'Real-time connected' : connection === 'connecting' ? 'Connecting…' : 'Saved mode'}</div></div>
    {error && <div className="chat-error" role="status"><FiWifi /><span>{error}</span><button type="button" onClick={loadChat}><FiRefreshCw /> Retry</button><button type="button" aria-label="Dismiss" onClick={() => setError('')}><FiX /></button></div>}
    <div className="chat-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-head"><div><span className="chat-overline">Your conversations</span><h2>{contactSummaries.length} people</h2></div><span className="chat-unread-total">{contactSummaries.reduce((total, contact) => total + contact.unread, 0) || ''}</span></div>
        <label className="chat-search"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, USN or family" aria-label="Search people, USN or family" /></label>
        <div className="chat-contact-list">{visibleContacts.map((contact) => <button type="button" className={`chat-contact ${selectedContact && contactKey(selectedContact) === contactKey(contact) ? 'active' : ''}`} key={contactKey(contact)} onClick={() => selectContact(contact)}><span className="chat-contact-avatar-wrap"><Avatar contact={contact} small /><i className={`chat-presence ${contact.online ? 'online' : ''}`} /></span><span className="chat-contact-copy"><span className="chat-contact-line"><strong>{contact.name}</strong><time>{contact.latest ? messageTime(contact.latest) : ''}</time></span><span className="chat-contact-meta">{contact.relationship}{contact.usn ? ` · ${contact.usn}` : ''}</span><span className="chat-contact-preview">{contact.latest?.body || `Start a private chat with ${contact.name}`}</span></span>{contact.unread > 0 && <b className="chat-contact-unread">{contact.unread}</b>}</button>)}{!visibleContacts.length && <div className="chat-empty-list"><FiMessageCircle /><span>No people match that search.</span></div>}</div>
      </aside>
      <section className="chat-conversation">
        {selectedContact ? <>
          <header className="chat-conversation-head"><div className="chat-recipient"><Avatar contact={selectedContact} /><div><h2>{selectedContact.name}</h2><p><span className={`chat-presence-inline ${selectedContact.online ? 'online' : ''}`} />{selectedContact.relationship} · {selectedContact.online ? 'Online now' : 'Offline'}{selectedContact.studentName && selectedContact.role === 'parent' ? ` · ${selectedContact.studentName}` : ''}</p></div></div><div className="chat-header-actions"><span className="chat-private-label"><FiWifi /> Private</span><button type="button" aria-label="Conversation options"><FiPlus /></button></div></header>
          <div className="chat-history" aria-live="polite">{selectedMessages.length ? selectedMessages.map((message) => { const outgoing = samePerson(message, user.id, user.role, 'sender'); return <div className={`chat-message-row ${outgoing ? 'outgoing' : 'incoming'}`} key={message.id}><div className="chat-message-bubble"><p>{message.body}</p><footer><time>{messageTime(message)}</time><StatusMark message={message} outgoing={outgoing} /></footer></div></div> }) : <div className="chat-empty-history"><span><FiMessageCircle /></span><h3>Start the conversation</h3><p>Messages to {selectedContact.name} are private to this chat.</p></div>}{typing && selectedContact && typing.key === contactKey(selectedContact) && <div className="chat-typing"><span><i /><i /><i /></span>{typing.name} is typing…</div>}</div>
          <form className="chat-composer" onSubmit={send}><div className="chat-composer-tools"><button type="button" aria-label="Add attachment" title="Attachments are coming soon" disabled><FiPaperclip /></button><button type="button" className={showEmoji ? 'active' : ''} aria-label="Add emoji" onClick={() => setShowEmoji((value) => !value)}><FiSmile /></button>{showEmoji && <div className="chat-emoji-popover">{EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => { setDraft((value) => `${value}${emoji}`); setShowEmoji(false) }}>{emoji}</button>)}</div>}</div><textarea value={draft} onChange={onDraftChange} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event) } }} placeholder={`Message ${selectedContact.name}…`} aria-label={`Message ${selectedContact.name}`} rows="1" /><button className="chat-send-button" type="submit" disabled={!draft.trim() || sending} aria-label="Send message">{sending ? <FiClock /> : <FiSend />}</button></form>
        </> : <div className="chat-no-selection"><FiMessageCircle /><h2>Select someone to chat</h2><p>Search the people in your communication scope to start a private conversation.</p></div>}
      </section>
    </div>
  </div>
}
