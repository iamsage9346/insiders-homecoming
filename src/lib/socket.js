import { io } from 'socket.io-client'

// dev: vite(5173)에서 별도 백엔드(3000)로 연결. prod: 같은 origin.
export const socket = io(import.meta.env.DEV ? 'http://localhost:3000' : undefined, {
  autoConnect: true,
})
