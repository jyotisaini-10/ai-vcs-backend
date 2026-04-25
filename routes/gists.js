import express from 'express'
import { auth } from '../middleware/auth.js'
import Gist from '../models/Gist.js'

const router = express.Router()

// POST /api/gists - Create a new gist
router.post('/', auth, async (req, res, next) => {
  try {
    const { title, content, language, isPublic } = req.body
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' })
    }

    const gist = await Gist.create({
      title,
      content,
      language: language || 'javascript',
      isPublic: isPublic !== undefined ? isPublic : true,
      owner: req.user._id
    })

    res.status(201).json({ gist })
  } catch (err) {
    next(err)
  }
})

// GET /api/gists - Get all gists for the user
router.get('/', auth, async (req, res, next) => {
  try {
    const gists = await Gist.find({ owner: req.user._id }).sort({ createdAt: -1 })
    res.json({ gists })
  } catch (err) {
    next(err)
  }
})

// GET /api/gists/:id - Get a specific gist
router.get('/:id', async (req, res, next) => {
  try {
    const gist = await Gist.findById(req.params.id).populate('owner', 'username email')
    if (!gist) return res.status(404).json({ message: 'Gist not found' })
    res.json({ gist })
  } catch (err) {
    next(err)
  }
})

export default router
