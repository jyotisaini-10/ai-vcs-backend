import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'
import mongoose from 'mongoose'

import authRoutes from './routes/auth.js'
import repoRoutes from './routes/repos.js'
import commitRoutes from './routes/commits.js'
import searchRoutes from './routes/search.js'
import { errorHandler } from './middleware/errorHandler.js'
import issueRoutes from './routes/issues.js'
import pullRoutes from './routes/pullrequests.js'
import discussionRoutes from './routes/discussions.js'


dotenv.config()

const app = express()
const httpServer = createServer(app)
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean)

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
})

// Middleware MUST come before all route registrations so req.body is parsed
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.set('io', io)

app.use('/api/auth', authRoutes)
app.use('/api/repos', repoRoutes)
app.use('/api/repos', commitRoutes)
app.use('/api/repos', searchRoutes)
app.use('/api/repos', issueRoutes)
app.use('/api/repos', pullRoutes)
app.use('/api/repos', discussionRoutes)

app.get('/', (req, res) => res.json({ message: 'AI VCS API is running' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

io.on('connection', (socket) => {
  socket.on('join-repo', (repoId) => socket.join(repoId))
  socket.on('leave-repo', (repoId) => socket.leave(repoId))
})

process.on('exit', () => httpServer.close())

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected')
    if (process.env.VERCEL !== '1') {
      httpServer.listen(process.env.PORT, () =>
        console.log(`Server running on port ${process.env.PORT}`)
      )
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  })

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port busy! Run: npx kill-port ${process.env.PORT}`)
    process.exit(1)
  }
})

export default app