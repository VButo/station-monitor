"use client"
import React, { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { Station, SmsMessage } from '@/types/station'
import api from '@/utils/api'

interface Props {
  station?: Station | null
}

export default function ModemTab(props: Readonly<Props>) {
  const { station } = props
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [messages, setMessages] = useState<SmsMessage[]>([])
  const [userMap, setUserMap] = useState<Record<string, string | null>>({})
  const userMapRef = useRef<Record<string, string | null>>(userMap)
  const socketRef = useRef<Socket | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  // Track list meta to control auto-scroll behavior
  const listMetaRef = useRef<{ len: number; lastId: number | null; stationId?: number }>({ len: 0, lastId: null, stationId: undefined })

  // keep ref in sync with state so the polling callback can read latest map
  useEffect(() => {
    userMapRef.current = userMap
  }, [userMap])

  const callBackendSend = async (number: string, text: string, stationId?: number) => {
    try {
      type SendPayload = { number: string; message: string; station_id?: number }
      const bodyPayload: SendPayload = { number, message: text }
      if (typeof stationId === 'number') bodyPayload.station_id = stationId
      const resp = await api.post<{ success: boolean; url?: string | null; error?: string | null }>(
        '/sms/send',
        bodyPayload
      )
      const body = resp.data || {}
      return { ok: body.success === true, url: body.url ?? null, error: body.error ?? null }
    } catch (err) {
      return { ok: false, url: null, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // Fetch initial messages and poll periodically for updates (no Supabase client in frontend)
  useEffect(() => {
    if (!station?.id) return

    let mounted = true
    const ac = new AbortController()

    const fetchMissingUsernames = async (userIds: string[]) => {
      try {
        const resp = await api.post<{ success: boolean; data?: Record<string, string | null> }>(
          '/sms/usernames',
          { userIds }
        )
        const jb = resp.data || null
        if (jb?.success && jb.data) {
          setUserMap((prev) => {
            const merged = { ...prev, ...jb.data }
            userMapRef.current = merged
            return merged
          })
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.warn('Failed to fetch usernames', e)
        }
      }
    }

    const fetchMessages = async () => {
      try {
        const resp = await api.get<{ success: boolean; data: SmsMessage[] }>(
          `/sms/station/${station.id}`
        )
        const body = resp.data || null
        if (!mounted) return
        if (body?.success && Array.isArray(body.data)) {
          mergeMessages(body.data)
          const ids: string[] = Array.from(
            new Set(
              body.data
                .map((m: SmsMessage) => m.user_id)
                .filter((v: string | null | undefined): v is string => typeof v === 'string' && v.length > 0)
            )
          )
          const missing = ids.filter((id) => !(id in userMapRef.current))
          if (missing.length > 0) {
            await fetchMissingUsernames(missing)
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.warn('Failed to fetch initial messages', e)
        }
      }
    }

    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)

    return () => {
      mounted = false
      ac.abort()
      clearInterval(interval)
    }
  }, [station?.id])

  // Socket.io: connect once and listen for realtime events
  useEffect(() => {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api'
  if (!apiBase) return
  // If NEXT_PUBLIC_API_URL includes an API path (e.g. '/api'), remove it
  // because socket.io is served at the root '/socket.io' path on the server.
  const socketBase = apiBase.replace(/\/api\/?$/, '')
  console.log('socket apiBase=', apiBase, '-> socketBase=', socketBase);
  console.log('socket options:', { withCredentials: true });
  const socket = io(socketBase, { withCredentials: true })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('socket connected', socket.id)
    })

    socket.on('sms:new', (msg: SmsMessage) => {
      try {
        mergeMessages([msg])
      } catch (e) { console.warn('sms:new handler error', e) }
    })

    socket.on('sms:update', (upd: { id: number; status: string }) => {
      setMessages((prev) => applyStatusUpdate(prev, upd.id, upd.status))
    })

    socket.on('disconnect', (reason: string | undefined) => {
      console.log('socket disconnected', reason)
    })

    return () => {
      try {
        socket.disconnect()
      } catch {
        /* ignore */
      }
      socketRef.current = null
    }
  }, [])

  // Join/leave station room when station changes
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    if (station?.id) {
      socket.emit('joinStation', station.id)
    }
    return () => {
      if (station?.id) socket.emit('leaveStation', station.id)
    }
  }, [station?.id])

  // Reset meta when station changes so the first load for that station will scroll
  useEffect(() => {
    listMetaRef.current = { len: 0, lastId: null, stationId: station?.id }
  }, [station?.id])

  // Scroll to bottom only on first load for the station or when a new message arrives
  useEffect(() => {
    const c = scrollContainerRef.current
    if (!c) return

    const prev = listMetaRef.current
    const len = messages.length
    const lastId = len > 0 ? messages[len - 1].id : null

    const isNewStation = prev.stationId !== station?.id
    const isFirstLoad = prev.len === 0 && len > 0
    const hasNewMessage = len > prev.len
    const lastChanged = len === prev.len && len > 0 && lastId !== prev.lastId
    const shouldScroll = isNewStation || isFirstLoad || hasNewMessage || lastChanged

    if (shouldScroll) {
      requestAnimationFrame(() => {
        try {
          c.scrollTop = c.scrollHeight
        } catch {
          /* ignore */
        }
      })
    }

    listMetaRef.current = { len, lastId, stationId: station?.id }
  }, [messages, station?.id])

  // (status mapping inlined in socket handler)

  function mergeMessages(rows: SmsMessage[]) {
    setMessages((prev) => {
      if (!rows || rows.length === 0) return prev
      const existingIds = new Set(prev.map((m) => m.id))
      let changed = false
      const merged = [...prev]
      for (const row of rows) {
        if (!existingIds.has(row.id)) {
          merged.push(row)
          changed = true
        }
      }
      return changed ? merged : prev
    })
  }

  // Error popup helper
  const showError = (msg: string) => {
    setErrorMsg(msg)
    try {
      setTimeout(() => setErrorMsg(null), 4000)
    } catch {
      /* ignore */
    }
  }

  // Helper to apply a status update to the list without excessive nesting in effects
  const applyStatusUpdate = (list: SmsMessage[], id: number, statusValue: string) => {
    let changed = false
    const next = list.map((m) => (m.id === id ? (changed = true, { ...m, status: statusValue }) : m))
    return changed ? next : list
  }

  const handleSend = async () => {
    if (sending) return
    const trimmed = message.trim()
    if (!trimmed) return
    if (!station) { showError('No station selected'); return }
    const number = station.sms_number ?? ''
    if (!number) { showError('Station has no sms_number configured'); return }

    setSending(true)
    setErrorMsg(null)
    try {
      const result = await callBackendSend(number, trimmed, station.id)
      if (result.ok) {
        setMessage('')
      } else if (result.url) {
        window.open(result.url, '_blank')
        setMessage('')
      } else {
        showError(`Error sending message: ${result.error ?? 'unknown'}`)
      }
    } catch (err: unknown) {
      const maybeError = err as { message?: unknown } | null
      const msg = maybeError && typeof maybeError.message === 'string' ? maybeError.message : String(err)
      showError(`Error: ${msg}`)
    } finally {
      setSending(false)
    }
  }

  return (
  <div className="h-full flex bg-white w-full">
      {/* Left station list removed: selection happens on the page-level now */}

      {/* Right: Chat area */}
      <main className="flex-1 p-1 flex flex-col h-120 min-w-0 max-w-full">

        {/* Messages */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-6 min-w-0 w-full">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-gray-400">
              <div>
                <div className="text-lg font-medium">No messages yet</div>
                <div className="text-sm">Messages will appear here when the station sends or receives modem traffic.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const isStationMsg = m.status === 'INBOX'
                let senderName: string
                if (isStationMsg) {
                  senderName = station?.label ?? 'Station'
                } else if (m.user_id) {
                  senderName = userMap[m.user_id] ?? 'Unknown user'
                } else {
                  senderName = 'Unknown user'
                }

                return (
                  <div key={m.id} className={`flex ${isStationMsg ? 'justify-start' : 'justify-end'}`}>
                    <div className={`${isStationMsg ? 'bg-gray-100 text-gray-800' : 'bg-blue-600 text-white'} px-4 py-2 rounded-lg break-words whitespace-pre-wrap w-fit max-w-[70%]`}>
                      <div className="flex items-center justify-between mb-1 gap-3">
                        <div className={`text-xs font-semibold ${isStationMsg ? 'text-gray-700' : 'text-white/90'}`}>{senderName}</div>
                        <div className={`text-[10px] ${isStationMsg ? 'text-gray-500' : 'text-white/70'} whitespace-nowrap`}>{new Date(m.time).toLocaleString()}</div>
                      </div>
                      <div className={`text-sm ${isStationMsg ? 'text-left' : 'text-right'}`}>{m.message}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Input area (UI only) */}
        <div className="pt-4 border-t border-gray-100 max-w-full">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="flex-1 sm:max-w-[70%] w-auto px-4 py-2 border text-gray-700 border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:ring-blue-200"
            />
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className={`px-4 py-2 rounded-full ${sending || !message.trim() ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white'}`}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </main>
      {/* Error popup (toast) */}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50">
          <div role="alert" aria-live="polite" className="max-w-sm flex items-start gap-3 rounded-lg border border-red-200 bg-white shadow-lg p-3">
            <div className="mt-0.5 text-red-500" aria-hidden>
              {/* Exclamation icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0v-5.5A.75.75 0 0110 5zm0 9a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-gray-800">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-gray-400 hover:text-gray-600" aria-label="Dismiss">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}