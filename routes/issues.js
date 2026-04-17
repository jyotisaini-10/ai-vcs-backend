import express from 'express'
import Issue from '../models/Issue.js'
import { auth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/repos/:id/issues
router.get('/:id/issues', auth, async (req, res, next) => {
  try {
    const { status, label } = req.query
    const query = { repoId: req.params.id }
    if (status) query.status = status
    if (label) query.label = label
    const issues = await Issue.find(query)
      .populate('author', 'username')
      .sort({ createdAt: -1 })
    res.json({ issues })
  } catch (err) { next(err) }
})

// POST /api/repos/:id/issues
router.post('/:id/issues', auth, async (req, res, next) => {
  try {
    const { title, body, label } = req.body
    if (!title) return res.status(400).json({ message: 'Title is required' })
    const issue = await Issue.create({
      repoId: req.params.id,
      title, body, label,
      author: req.user._id
    })
    const populated = await issue.populate('author', 'username')
    res.status(201).json({ issue: populated })
  } catch (err) { next(err) }
})

// GET /api/repos/:id/issues/:issueId
router.get('/:id/issues/:issueId', auth, async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.issueId)
      .populate('author', 'username')
      .populate('comments.author', 'username')
    if (!issue) return res.status(404).json({ message: 'Issue not found' })
    res.json({ issue })
  } catch (err) { next(err) }
})

// PATCH /api/repos/:id/issues/:issueId — open/close
router.patch('/:id/issues/:issueId', auth, async (req, res, next) => {
  try {
    const { status } = req.body
    const issue = await Issue.findByIdAndUpdate(
      req.params.issueId,
      { status },
      { new: true }
    ).populate('author', 'username')
    res.json({ issue })
  } catch (err) { next(err) }
})

// POST /api/repos/:id/issues/:issueId/comments
router.post('/:id/issues/:issueId/comments', auth, async (req, res, next) => {
  try {
    const { body } = req.body
    if (!body) return res.status(400).json({ message: 'Comment body required' })
    const issue = await Issue.findByIdAndUpdate(
      req.params.issueId,
      { $push: { comments: { author: req.user._id, body } } },
      { new: true }
    ).populate('author', 'username').populate('comments.author', 'username')
    res.json({ issue })
  } catch (err) { next(err) }
})

// DELETE /api/repos/:id/issues/:issueId
router.delete('/:id/issues/:issueId', auth, async (req, res, next) => {
  try {
    await Issue.findByIdAndDelete(req.params.issueId)
    res.json({ message: 'Issue deleted' })
  } catch (err) { next(err) }
})

export default router