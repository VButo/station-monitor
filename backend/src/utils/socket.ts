import http from 'node:http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

let ioServer: Server | null = null

export async function initSocket(server: http.Server, corsOrigins: string[] = []) {
  if (ioServer) return ioServer

  // Support flexible CORS handling: accept the request Origin when it is
  // present in the allowed list. This is required when the client uses
  // credentials (cookies) because Access-Control-Allow-Origin cannot be
  // the wildcard (*) in that case.
  ioServer = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // If no Origin header (non-browser client), allow it
        if (!origin) return callback(null, true)
        if (corsOrigins.includes(origin)) return callback(null, true)
        const err = new Error('Origin not allowed')
        return callback(err)
      },
      credentials: true,
    },
  })

  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL })
      const subClient = pubClient.duplicate()
      await pubClient.connect()
      await subClient.connect()
      ioServer.adapter(createAdapter(pubClient, subClient))
      console.log('Socket.io Redis adapter connected')
    } catch (err) {
      console.warn('Failed to connect Redis for socket adapter:', err)
    }
  }

  ioServer.on('connection', (socket) => {
    console.log('Socket connected', socket.id)
    socket.on('joinStation', (stationId: number) => {
      try {
        socket.join(`station:${stationId}`)
        console.log(`Socket ${socket.id} joined station:${stationId}`)
      } catch (e) {
        console.warn('joinStation error', e)
      }
    })
    socket.on('leaveStation', (stationId: number) => {
      try {
        socket.leave(`station:${stationId}`)
      } catch (e) {
        console.warn('leaveStation error', e)
      }
    })
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected', socket.id, reason)
    })
  })

  return ioServer
}

export function getIo() {
  if (!ioServer) throw new Error('Socket.io not initialized')
  return ioServer
}
