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
      const repos = await Repo.find({ isPrivate: false })
        .populate('owner', 'username avatar bio')
        .sort({ updatedAt: -1 })
        .limit(10)

      const users = await User.find({})
        .select('username bio avatar location createdAt followers following')
        .sort({ createdAt: -1 })
        .limit(8)

      return res.json({ repos, users, query: '' })
    }

    const regex = new RegExp(query, 'i')

    const [users, repos] = await Promise.all([
      type !== 'repos'
        ? User.find({ $or: [{ username: regex }, { bio: regex }] })
            .select('username bio avatar location createdAt followers following')
            .limit(8)
        : [],
      type !== 'users'
        ? Repo.find({ isPrivate: false, $or: [{ name: regex }, { description: regex }] })
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
      .select('username bio avatar location website createdAt followers following')
      .populate('followers', 'username avatar bio')
      .populate('following', 'username avatar bio')

    if (!user) return res.status(404).json({ message: 'User not found' })

    const repos = await Repo.find({ owner: user._id, isPrivate: false })
      .sort({ updatedAt: -1 })
      .limit(20)

    // Check if logged-in user follows this person
    const isFollowing = user.followers.some(f => f._id.toString() === req.user._id.toString())

    res.json({ user, repos, isFollowing })
  } catch (err) {
    next(err)
  }
})

// GET /api/explore/me/followers — get my followers
router.get('/me/followers', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('followers', 'username bio avatar location followers following')
    res.json({ users: user.followers || [] })
  } catch (err) {
    next(err)
  }
})

// GET /api/explore/me/following — get who I follow
router.get('/me/following', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('following', 'username bio avatar location followers following')
    res.json({ users: user.following || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/explore/user/:username/follow — follow a user
router.post('/user/:username/follow', auth, async (req, res, next) => {
  try {
    const target = await User.findOne({ username: req.params.username })
    if (!target) return res.status(404).json({ message: 'User not found' })

    const myId = req.user._id
    const targetId = target._id

    if (myId.toString() === targetId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' })
    }

    // Check already following
    if (target.followers.map(id => id.toString()).includes(myId.toString())) {
      return res.status(400).json({ message: 'Already following' })
    }

    await Promise.all([
      User.findByIdAndUpdate(targetId, { $addToSet: { followers: myId } }),
      User.findByIdAndUpdate(myId, { $addToSet: { following: targetId } })
    ])

    res.json({ message: 'Followed successfully' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/explore/user/:username/follow — unfollow a user
router.delete('/user/:username/follow', auth, async (req, res, next) => {
  try {
    const target = await User.findOne({ username: req.params.username })
    if (!target) return res.status(404).json({ message: 'User not found' })

    const myId = req.user._id
    const targetId = target._id

    await Promise.all([
      User.findByIdAndUpdate(targetId, { $pull: { followers: myId } }),
      User.findByIdAndUpdate(myId, { $pull: { following: targetId } })
    ])

    res.json({ message: 'Unfollowed successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
