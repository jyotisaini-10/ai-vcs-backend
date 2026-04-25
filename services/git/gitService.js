import git from 'isomorphic-git'
import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import Commit from '../../models/Commit.js'

dotenv.config()

const REPOS_DIR = process.env.REPOS_DIR || './repos'

export function repoPath(repoId) {
  return path.join(REPOS_DIR, repoId.toString())
}

/**
 * Rebuilds the git working directory from MongoDB commit history.
 * Called whenever /tmp is wiped on a Vercel cold start.
 */
async function rebuildRepoFromDB(repoId) {
  const dir = repoPath(repoId)
  await fs.mkdir(dir, { recursive: true })
  await git.init({ fs, dir, defaultBranch: 'main' })

  // Fetch all commits for this repo in chronological order
  const commits = await Commit.find({ repoId })
    .sort({ createdAt: 1 })
    .lean()

  if (commits.length === 0) {
    // No commits yet — just create a placeholder so HEAD exists
    const placeholder = path.join(dir, '.gitkeep')
    await fs.writeFile(placeholder, '')
    await git.add({ fs, dir, filepath: '.gitkeep' })
    await git.commit({
      fs, dir,
      message: 'Initial commit',
      author: { name: 'AI-VCS', email: 'system@ai-vcs.dev' }
    })
    return
  }

  // Replay each commit: write files then commit
  for (const commit of commits) {
    const filesWithContent = (commit.filesChanged || []).filter(f => f.content && f.status !== 'deleted')
    if (filesWithContent.length === 0) continue

    for (const file of filesWithContent) {
      const filePath = path.join(dir, file.filename)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, file.content)
      await git.add({ fs, dir, filepath: file.filename })
    }

    // Handle deleted files
    const deletedFiles = (commit.filesChanged || []).filter(f => f.status === 'deleted')
    for (const file of deletedFiles) {
      try {
        await fs.unlink(path.join(dir, file.filename))
        await git.remove({ fs, dir, filepath: file.filename })
      } catch {}
    }

    await git.commit({
      fs, dir,
      message: commit.message,
      author: { name: 'AI-VCS', email: 'system@ai-vcs.dev' }
    })
  }
}

/**
 * Ensures the git repo exists in /tmp. If missing, rebuilds from DB.
 */
async function ensureRepo(repoId) {
  const dir = repoPath(repoId)
  const gitDir = path.join(dir, '.git')
  try {
    await fs.access(gitDir)
  } catch {
    console.log(`[gitService] Repo ${repoId} missing from disk — rebuilding from DB...`)
    await rebuildRepoFromDB(repoId)
  }
}

export async function initRepo(repoId) {
  const dir = repoPath(repoId)
  await fs.mkdir(dir, { recursive: true })
  await git.init({ fs, dir, defaultBranch: 'main' })

  const readmePath = path.join(dir, 'README.md')
  await fs.writeFile(readmePath, `# Repository\n\nCreated with AI-VCS\n`)
  await git.add({ fs, dir, filepath: 'README.md' })
  await git.commit({
    fs, dir,
    message: 'Initial commit',
    author: { name: 'AI-VCS', email: 'system@ai-vcs.dev' }
  })

  return dir
}

export async function writeAndCommit({ repoId, files, message, author, branch = 'main' }) {
  const dir = repoPath(repoId)

  // Ensure repo is present (rebuild from DB if cold start wiped /tmp)
  await ensureRepo(repoId)

  const fileStats = []

  for (const file of files) {
    const filePath = path.join(dir, file.name)
    const fileDir = path.dirname(filePath)

    let status = 'modified'
    try { await fs.access(filePath) } catch { status = 'added' }

    await fs.mkdir(fileDir, { recursive: true })
    await fs.writeFile(filePath, file.content)
    await git.add({ fs, dir, filepath: file.name })

    fileStats.push({
      filename: file.name,
      status,
      additions: file.content.split('\n').length,
      deletions: 0,
      content: file.content  // ← persist content in DB
    })
  }

  const sha = await git.commit({
    fs,
    dir,
    message,
    author: { name: author.username, email: author.email }
  })

  return { sha, fileStats }
}

export async function getCommitDiff(repoId, sha) {
  const dir = repoPath(repoId)
  const diffs = []

  // Ensure repo is present
  await ensureRepo(repoId)

  try {
    const log = await git.log({ fs, dir, depth: 2, ref: sha })

    if (log.length < 2) {
      const files = await git.listFiles({ fs, dir, ref: sha })
      for (const filepath of files) {
        const { blob } = await git.readBlob({ fs, dir, oid: sha, filepath })
        const content = new TextDecoder().decode(blob)
        diffs.push({ file: filepath, before: '', after: content, type: 'added' })
      }
      return diffs
    }

    const [current, parent] = log

    await git.walk({
      fs,
      dir,
      trees: [git.TREE({ ref: parent.oid }), git.TREE({ ref: current.oid })],
      map: async (filepath, [a, b]) => {
        if (filepath === '.') return
        try {
          const aContent = a ? new TextDecoder().decode(await a.content()) : ''
          const bContent = b ? new TextDecoder().decode(await b.content()) : ''

          if (aContent !== bContent) {
            diffs.push({
              file: filepath,
              before: aContent,
              after: bContent,
              type: !a ? 'added' : !b ? 'deleted' : 'modified'
            })
          }
        } catch {}
      }
    })
  } catch (err) {
    console.error(`[gitService] getCommitDiff error for repo ${repoId}, sha ${sha}:`, err.message)
  }

  return diffs
}

export async function getLog(repoId, branch = 'main', depth = 50) {
  const dir = repoPath(repoId)
  try {
    await ensureRepo(repoId)
    const log = await git.log({ fs, dir, ref: branch, depth })
    return log
  } catch {
    return []
  }
}

export async function getBranches(repoId) {
  const dir = repoPath(repoId)
  await ensureRepo(repoId)
  return git.listBranches({ fs, dir })
}

export async function createBranch(repoId, branchName, fromBranch = 'main') {
  const dir = repoPath(repoId)
  await ensureRepo(repoId)
  await git.checkout({ fs, dir, ref: fromBranch })
  await git.branch({ fs, dir, ref: branchName })
  return branchName
}

export async function getFileTree(repoId, branch = 'main') {
  const dir = repoPath(repoId)
  try {
    await ensureRepo(repoId)
    const sha = await git.resolveRef({ fs, dir, ref: branch })
    const files = await git.listFiles({ fs, dir, ref: sha })
    return files
  } catch {
    return []
  }
}

export async function readFile(repoId, filepath, branch = 'main') {
  const dir = repoPath(repoId)
  await ensureRepo(repoId)
  const sha = await git.resolveRef({ fs, dir, ref: branch })
  const { blob } = await git.readBlob({ fs, dir, oid: sha, filepath })
  return new TextDecoder().decode(blob)
}