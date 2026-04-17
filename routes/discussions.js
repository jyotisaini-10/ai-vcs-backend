import express from 'express'
import Discussion from '../models/Discussion.js'
import { auth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/repos/:id/discussions
router.get('/:id/discussions', auth, async (req, res, next) => {
  try {
    const { category } = req.query
    const query = { repoId: req.params.id }
    if (category) query.category = category
    const discussions = await Discussion.find(query)
      .populate('author', 'username')
      .sort({ pinned: -1, createdAt: -1 })
    res.json({ discussions })
  } catch (err) { next(err) }
})

// POST /api/repos/:id/discussions
router.post('/:id/discussions', auth, async (req, res, next) => {
  try {
    const { title, body, category } = req.body
    if (!title) return res.status(400).json({ message: 'Title is required' })
    const discussion = await Discussion.create({
      repoId: req.params.id, title, body, category, author: req.user._id
    })
    const populated = await discussion.populate('author', 'username')
    res.status(201).json({ discussion: populated })
  } catch (err) { next(err) }
})

// GET /api/repos/:id/discussions/:discussionId
router.get('/:id/discussions/:discussionId', auth, async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.discussionId)
      .populate('author', 'username')
      .populate('replies.author', 'username')
    if (!discussion) return res.status(404).json({ message: 'Discussion not found' })
    res.json({ discussion })
  } catch (err) { next(err) }
})

// POST /api/repos/:id/discussions/:discussionId/replies
router.post('/:id/discussions/:discussionId/replies', auth, async (req, res, next) => {
  try {
    const { body } = req.body
    if (!body) return res.status(400).json({ message: 'Reply body required' })
    const discussion = await Discussion.findByIdAndUpdate(
      req.params.discussionId,
      { $push: { replies: { author: req.user._id, body } } },
      { new: true }
    ).populate('author', 'username').populate('replies.author', 'username')
    res.json({ discussion })
  } catch (err) { next(err) }
})

// PATCH /api/repos/:id/discussions/:discussionId — pin/lock/vote
router.patch('/:id/discussions/:discussionId', auth, async (req, res, next) => {
  try {
    const { pinned, locked, votes } = req.body
    const update = {}
    if (pinned !== undefined) update.pinned = pinned
    if (locked !== undefined) update.locked = locked
    if (votes !== undefined) update.votes = votes
    const discussion = await Discussion.findByIdAndUpdate(
      req.params.discussionId, update, { new: true }
    ).populate('author', 'username')
    res.json({ discussion })
  } catch (err) { next(err) }
})

// PATCH mark reply as answer
router.patch('/:id/discussions/:discussionId/replies/:replyId/answer', auth, async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.discussionId)
    discussion.replies.forEach(r => { r.isAnswer = r._id.toString() === req.params.replyId })
    await discussion.save()
    await discussion.populate('author', 'username')
    await discussion.populate('replies.author', 'username')
    res.json({ discussion })
  } catch (err) { next(err) }
})

// DELETE /api/repos/:id/discussions/:discussionId
router.delete('/:id/discussions/:discussionId', auth, async (req, res, next) => {
  try {
    await Discussion.findByIdAndDelete(req.params.discussionId)
    res.json({ message: 'Discussion deleted' })
  } catch (err) { next(err) }
})

export default router