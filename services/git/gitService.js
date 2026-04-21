import git from 'isomorphic-git'
import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const REPOS_DIR = process.env.REPOS_DIR || './repos'

export function repoPath(repoId) {
  return path.join(REPOS_DIR, repoId.toString())
}

export async function initRepo(repoId) {
  const dir = repoPath(repoId)
  await fs.mkdir(dir, { recursive: true })
  await git.init({ fs, dir, defaultBranch: 'main' })

  // Create initial README
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
  const fileStats = []

  // Auto-init git repo if it doesn't exist (e.g. Vercel cold start wiped /tmp)
  const gitDir = path.join(dir, '.git')
  let gitExists = false
  try { await fs.access(gitDir); gitExists = true } catch { gitExists = false }

  if (!gitExists) {
    await fs.mkdir(dir, { recursive: true })
    await git.init({ fs, dir, defaultBranch: 'main' })
    // Create a placeholder initial commit so HEAD exists
    const placeholderPath = path.join(dir, '.gitkeep')
    await fs.writeFile(placeholderPath, '')
    await git.add({ fs, dir, filepath: '.gitkeep' })
    await git.commit({
      fs, dir,
      message: 'Initial commit',
      author: { name: 'AI-VCS', email: 'system@ai-vcs.dev' }
    })
  }

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
      deletions: 0
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

  // If git repo doesn't exist (cold start wiped /tmp), return empty diffs
  try { await fs.access(path.join(dir, '.git')) } catch { return diffs }

  try {
    const log = await git.log({ fs, dir, depth: 2, ref: sha })

    if (log.length < 2) {
      // First commit — compare against empty tree
      const files = await git.listFiles({ fs, dir, ref: sha })
      for (const filepath of files) {
        const { blob } = await git.readBlob({
          fs, dir,
          oid: sha,
          filepath
        })
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
    console.error('getDiff error:', err.message)
  }

  return diffs
}

export async function getLog(repoId, branch = 'main', depth = 50) {
  const dir = repoPath(repoId)
  try {
    const log = await git.log({ fs, dir, ref: branch, depth })
    return log
  } catch {
    return []
  }
}

export async function getBranches(repoId) {
  const dir = repoPath(repoId)
  return git.listBranches({ fs, dir })
}

export async function createBranch(repoId, branchName, fromBranch = 'main') {
  const dir = repoPath(repoId)
  await git.checkout({ fs, dir, ref: fromBranch })
  await git.branch({ fs, dir, ref: branchName })
  return branchName
}

export async function getFileTree(repoId, branch = 'main') {
  const dir = repoPath(repoId)
  try {
    await fs.access(path.join(dir, '.git'))
    const sha = await git.resolveRef({ fs, dir, ref: branch })
    const files = await git.listFiles({ fs, dir, ref: sha })
    return files
  } catch {
    return []
  }
}

export async function readFile(repoId, filepath, branch = 'main') {
  const dir = repoPath(repoId)
  const sha = await git.resolveRef({ fs, dir, ref: branch })
  const { blob } = await git.readBlob({ fs, dir, oid: sha, filepath })
  return new TextDecoder().decode(blob)
}