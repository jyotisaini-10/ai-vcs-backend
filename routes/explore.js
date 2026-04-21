import express from 'express'
import { auth } from '../middleware/auth.js'
import User from '../models/User.js'
import Repo from '../models/Repo.js'

const router = express.Router()

// GET /api/explore?q=query  — search users and public repos
router.get('/', auth, async (req, res, next) => {
  try {
    const { q = '', type = 'all' } = req.query
    const query = q.trim()

    if (!query) {
      // Return trending: most recent public repos & users
      const repos = await Repo.find({ isPrivate: false })
        .populate('owner', 'username avatar bio')
        .sort({ updatedAt: -1 })
        .limit(10)

      const users = await User.find({})
        .select('username bio avatar location createdAt')
        .sort({ createdAt: -1 })
        .limit(8)

      return res.json({ repos, users, query: '' })
    }

    const regex = new RegExp(query, 'i')

    const [users, repos] = await Promise.all([
      type !== 'repos'
        ? User.find({ $or: [{ username: regex }, { bio: regex }] })
            .select('username bio avatar location createdAt')
            .limit(8)
        : [],
      type !== 'users'
        ? Repo.find({
            isPrivate: false,
            $or: [{ name: regex }, { description: regex }]
          })
            .populate('owner', 'username avatar')
            .sort({ totalCommits: -1 })
            .limit(12)
        : []
    ])

    res.json({ users, repos, query })
  } catch (err) {
    next(err)
  }
})

// GET /api/explore/user/:username — view any user's public profile
router.get('/user/:username', auth, async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('username bio avatar location website createdAt')

    if (!user) return res.status(404).json({ message: 'User not found' })

    const repos = await Repo.find({ owner: user._id, isPrivate: false })
      .sort({ updatedAt: -1 })
      .limit(20)

    res.json({ user, repos })
  } catch (err) {
    next(err)
  }
})

export default router
