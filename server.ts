import { startSocketServer } from './src/lib/socket-server'

const port = parseInt(process.env.SOCKET_PORT || '3001', 10)
startSocketServer(port)
console.log(`[MediBill Pro] Real-time server started on port ${port}`)
