import { promises as fs } from 'fs'
import path from 'path'
import { generateEmbedding } from '../ai/aiService.js'

const STORE_DIR = process.env.REPOS_DIR || './repos'

function storePath(repoId) {
  return path.join(STORE_DIR, repoId.toString(), '.ai-index.json')
}

export async function loadStore(repoId) {
  try {
    const raw = await fs.readFile(storePath(repoId), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function saveStore(repoId, store) {
  await fs.writeFile(storePath(repoId), JSON.stringify(store), 'utf-8')
}

export async function indexFile(repoId, filename, content) {
  const store = await loadStore(repoId)

  // Remove old entry for this file
  const filtered = store.filter((e) => e.filename !== filename)

  const embedding = await generateEmbedding(`File: ${filename}\n\n${content}`)

  filtered.push({
    filename,
    content: content.slice(0, 500),
    embedding,
    indexedAt: new Date().toISOString()
  })

  await saveStore(repoId, filtered)
}

export async function indexMultipleFiles(repoId, files) {
  const store = await loadStore(repoId)
  const filenames = files.map((f) => f.name)
  const filtered = store.filter((e) => !filenames.includes(e.filename))

  const newEntries = await Promise.all(
    files.map(async (file) => {
      const embedding = await generateEmbedding(`File: ${file.name}\n\n${file.content}`)
      return {
        filename: file.name,
        content: file.content.slice(0, 500),
        embedding,
        indexedAt: new Date().toISOString()
      }
    })
  )

  await saveStore(repoId, [...filtered, ...newEntries])
  return newEntries.length
}

export async function searchStore(repoId, queryEmbedding, topK = 5) {
  const store = await loadStore(repoId)
  if (store.length === 0) return []

  const scored = store.map((item) => ({
    filename: item.filename,
    content: item.content,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }))

  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] ** 2
    magB += b[i] ** 2
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
