import express from 'express'
import PullRequest from '../models/PullRequest.js'
import { auth } from '../middleware/auth.js'
import Groq from 'groq-sdk'
import dotenv from 'dotenv'
dotenv.config()

const router = express.Router()
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// GET /api/repos/:id/pulls
router.get('/:id/pulls', auth, async (req, res, next) => {
  try {
    const { status } = req.query
    const query = { repoId: req.params.id }
    if (status) query.status = status
    const pulls = await PullRequest.find(query)
      .populate('author', 'username')
      .sort({ createdAt: -1 })
    res.json({ pulls })
  } catch (err) { next(err) }
})

// POST /api/repos/:id/pulls
router.post('/:id/pulls', auth, async (req, res, next) => {
  try {
    const { title, body, fromBranch, toBranch } = req.body
    if (!title) return res.status(400).json({ message: 'Title is required' })
    const pull = await PullRequest.create({
      repoId: req.params.id,
      title, body, fromBranch, toBranch,
      author: req.user._id
    })
    const populated = await pull.populate('author', 'username')
    res.status(201).json({ pull: populated })

    // AI review in background
    runAIReview(pull._id, body, title).catch(console.error)
  } catch (err) { next(err) }
})

async function runAIReview(pullId, body, title) {
  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Review this pull request and give brief feedback in 3-4 sentences:
Title: ${title}
Description: ${body || 'No description provided'}
Focus on: code quality, potential issues, and whether it should be merged.`
      }]
    })
    await PullRequest.findByIdAndUpdate(pullId, {
      aiReview: res.choices[0].message.content.trim(),
      aiStatus: 'complete'
    })
  } catch {
    await PullRequest.findByIdAndUpdate(pullId, { aiStatus: 'failed' })
  }
}

// GET /api/repos/:id/pulls/:pullId
router.get('/:id/pulls/:pullId', auth, async (req, res, next) => {
  try {
    const pull = await PullRequest.findById(req.params.pullId)
      .populate('author', 'username')
      .populate('comments.author', 'username')
    if (!pull) return res.status(404).json({ message: 'Pull request not found' })
    res.json({ pull })
  } catch (err) { next(err) }
})

// PATCH /api/repos/:id/pulls/:pullId
router.patch('/:id/pulls/:pullId', auth, async (req, res, next) => {
  try {
    const { status } = req.body
    const pull = await PullRequest.findByIdAndUpdate(
      req.params.pullId,
      { status },
      { new: true }
    ).populate('author', 'username')
    res.json({ pull })
  } catch (err) { next(err) }
})

// POST /api/repos/:id/pulls/:pullId/comments
router.post('/:id/pulls/:pullId/comments', auth, async (req, res, next) => {
  try {
    const { body } = req.body
    if (!body) return res.status(400).json({ message: 'Comment required' })
    const pull = await PullRequest.findByIdAndUpdate(
      req.params.pullId,
      { $push: { comments: { author: req.user._id, body } } },
      { new: true }
    ).populate('author', 'username').populate('comments.author', 'username')
    res.json({ pull })
  } catch (err) { next(err) }
})

// DELETE /api/repos/:id/pulls/:pullId
router.delete('/:id/pulls/:pullId', auth, async (req, res, next) => {
  try {
    await PullRequest.findByIdAndDelete(req.params.pullId)
    res.json({ message: 'Pull request deleted' })
  } catch (err) { next(err) }
})

export default router