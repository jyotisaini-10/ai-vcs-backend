import express from 'express'
import Repo from '../models/Repo.js'
import User from '../models/User.js'
import Commit from '../models/Commit.js'
import { auth } from '../middleware/auth.js'
import { initRepo, getBranches, getFileTree, readFile } from '../services/git/gitService.js'

const router = express.Router()

// GET /api/repos — list repos for logged-in user
router.get('/', auth, async (req, res, next) => {
  try {
    const repos = await Repo.find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    })
      .populate('owner', 'username avatar')
      .sort({ updatedAt: -1 })

    res.json({ repos })
  } catch (err) {
    next(err)
  }
})

// POST /api/repos — create a new repo
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, description, isPrivate } = req.body

    if (!name) return res.status(400).json({ message: 'Repo name is required' })

    const exists = await Repo.findOne({ owner: req.user._id, name })
    if (exists) {
      return res.status(400).json({ message: 'Repository with this name already exists' })
    }

    const repo = await Repo.create({
      name,
      description,
      isPrivate: isPrivate || false,
      owner: req.user._id
    })

    // Init git repo on disk
    await initRepo(repo._id)

    // Add to user's repos list
    await User.findByIdAndUpdate(req.user._id, { $push: { repos: repo._id } })

    const populated = await repo.populate('owner', 'username avatar')
    res.status(201).json({ repo: populated })
  } catch (err) {
    next(err)
  }
})

// GET /api/repos/:id — get single repo
router.get('/:id', auth, async (req, res, next) => {
  try {
    const repo = await Repo.findById(req.params.id).populate('owner', 'username avatar')
    if (!repo) return res.status(404).json({ message: 'Repository not found' })

    const branches = await getBranches(req.params.id).catch(() => ['main'])
    const files = await getFileTree(req.params.id, repo.defaultBranch).catch(() => [])

    res.json({ repo, branches, files })
  } catch (err) {
    next(err)
  }
})

// GET /api/repos/:id/files/:branch — get file tree for a branch
router.get('/:id/files/:branch', auth, async (req, res, next) => {
  try {
    const files = await getFileTree(req.params.id, req.params.branch)
    res.json({ files })
  } catch (err) {
    next(err)
  }
})

// GET /api/repos/:id/file — get file content
router.get('/:id/file', auth, async (req, res, next) => {
  try {
    const { filepath, branch = 'main' } = req.query
    if (!filepath) return res.status(400).json({ message: 'filepath required' })

    // Try git filesystem first
    try {
      const content = await readFile(req.params.id, filepath, branch)
      return res.json({ content, filepath, branch })
    } catch (gitErr) {
      console.warn(`[repos] git readFile failed for ${filepath}, falling back to DB:`, gitErr.message)
    }

    // Fallback: find most recent commit that has content for this file in MongoDB
    const commits = await Commit.find({
      repoId: req.params.id,
      'filesChanged.filename': filepath
    }).sort({ createdAt: -1 }).limit(10).lean()

    for (const commit of commits) {
      const fileEntry = commit.filesChanged.find(
        f => f.filename === filepath && f.content && f.status !== 'deleted'
      )
      if (fileEntry) {
        return res.json({ content: fileEntry.content, filepath, branch, source: 'db' })
      }
    }

    // Last resort: check if file appears in diff field
    if (commits.length > 0 && commits[0].diff) {
      return res.json({ content: `// File content not available for older commits.\n// Please re-commit this file to restore it.`, filepath, branch })
    }

    return res.status(404).json({ message: 'File not found' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/repos/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const repo = await Repo.findOne({ _id: req.params.id, owner: req.user._id })
    if (!repo) return res.status(404).json({ message: 'Repository not found' })

    await repo.deleteOne()
    await User.findByIdAndUpdate(req.user._id, { $pull: { repos: repo._id } })

    res.json({ message: 'Repository deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
