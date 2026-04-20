import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
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

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.set('io', { to: () => ({ emit: () => { } }) })

// ✅ MOVED UP - Connect to MongoDB BEFORE routes
let isConnected = false
const connectDB = async () => {
  if (isConnected) return
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables')
    return
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    isConnected = true
    console.log('MongoDB connected successfully')
  } catch (err) {
    console.error('MongoDB connection error:', err.message)
  }
}

// ✅ DB middleware BEFORE routes
app.use(async (req, res, next) => {
  try {
    await connectDB()
    if (!isConnected && req.path !== '/api/health' && req.path !== '/') {
      return res.status(503).json({ message: 'Database connection failed. Please check MONGODB_URI and IP whitelist.' })
    }
    next()
  } catch (err) {
    next(err)
  }
})

// Routes come AFTER the DB middleware
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

// Local development only
if (process.env.NODE_ENV !== 'production') {
  connectDB().then(() => {
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    )
  })
}

export default app