import express from 'express'
import Commit from '../models/Commit.js'
import Repo from '../models/Repo.js'
import { auth } from '../middleware/auth.js'
import { writeAndCommit, getCommitDiff } from '../services/git/gitService.js'
import {
  generateCommitMessage,
  reviewCode,
  analyzeImpact,
  resolveConflict
} from '../services/ai/aiService.js'
import { indexMultipleFiles } from '../services/storage/vectorStore.js'

const router = express.Router()

// POST /api/repos/:id/commit — push files + trigger AI analysis
router.post('/:id/commit', auth, async (req, res, next) => {
  try {
    const { files, message, branch = 'main' } = req.body
    const repoId = req.params.id

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files provided' })
    }

    const repo = await Repo.findById(repoId)
    if (!repo) return res.status(404).json({ message: 'Repository not found' })

    // 1. Write files & create git commit
    const { sha, fileStats } = await writeAndCommit({
      repoId,
      files,
      message: message || 'Update files',
      author: req.user,
      branch
    })

    // 2. Get diff for AI analysis
    const diffs = await getCommitDiff(repoId, sha)

    // 3. Create DB record immediately (AI runs async)
    const commit = await Commit.create({
      repoId,
      sha,
      message: message || 'Update files',
      author: req.user._id,
      branch,
      filesChanged: fileStats,
      diff: diffs.map((d) => `--- ${d.file}\n${d.after}`).join('\n\n'),
      aiStatus: 'pending'
    })

    // Respond to client immediately — don't wait for AI
    res.status(201).json({ commit, sha })

    // 4. Run AI analysis in background
    runAIAnalysis(commit._id, repoId, diffs, files, req.app.get('io')).catch(console.error)

    // 5. Update repo counters
    await Repo.findByIdAndUpdate(repoId, {
      $inc: { totalCommits: 1 },
      $set: { updatedAt: new Date() },
      $addToSet: { branches: branch }
    })
  } catch (err) {
    next(err)
  }
})

async function runAIAnalysis(commitId, repoId, diffs, files, io) {
  try {
    const [aiMessage, reviewComments, impact] = await Promise.all([
      generateCommitMessage(diffs),
      reviewCode(diffs),
      analyzeImpact(diffs)
    ])

    // Index files in vector store for semantic search
    await indexMultipleFiles(repoId, files).catch(() => {})

    await Commit.findByIdAndUpdate(commitId, {
      aiMessage,
      reviewComments,
      impactScore: impact.score,
      impactSummary: impact.summary,
      aiStatus: 'complete'
    })

    // Emit real-time update to repo room
    if (io) {
      io.to(repoId.toString()).emit('ai-analysis-complete', {
        commitId,
        aiMessage,
        reviewComments,
        impactScore: impact.score,
        impactSummary: impact.summary
      })
    }
  } catch (err) {
    console.error('AI analysis failed:', err.message)
    await Commit.findByIdAndUpdate(commitId, { aiStatus: 'failed' })
  }
}

// GET /api/repos/:id/commits — list commit history
router.get('/:id/commits', auth, async (req, res, next) => {
  try {
    const { branch, page = 1, limit = 20 } = req.query
    const query = { repoId: req.params.id }
    if (branch) query.branch = branch

    const commits = await Commit.find(query)
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))

    const total = await Commit.countDocuments(query)

    res.json({ commits, total, page: parseInt(page), pages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
})

// GET /api/repos/:id/commits/:sha — get single commit detail
router.get('/:id/commits/:sha', auth, async (req, res, next) => {
  try {
    const commit = await Commit.findOne({
      repoId: req.params.id,
      sha: req.params.sha
    }).populate('author', 'username avatar')

    if (!commit) return res.status(404).json({ message: 'Commit not found' })

    const diffs = await getCommitDiff(req.params.id, req.params.sha).catch(() => [])

    res.json({ commit, diffs })
  } catch (err) {
    next(err)
  }
})

// POST /api/repos/:id/resolve — AI conflict resolution
router.post('/:id/resolve', auth, async (req, res, next) => {
  try {
    const { base, ours, theirs, filename } = req.body

    if (!ours || !theirs) {
      return res.status(400).json({ message: 'ours and theirs are required' })
    }

    const resolved = await resolveConflict({ base: base || '', ours, theirs, filename })
    res.json({ resolved, filename })
  } catch (err) {
    next(err)
  }
})

export default router
