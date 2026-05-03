import type { Server as SocketIOServer } from 'socket.io'

declare global {
  // Shared by the custom server and App Router route handlers in this Node process.
  var io: SocketIOServer | undefined
}

export {}
