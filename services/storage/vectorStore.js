import { generateEmbedding } from '../ai/aiService.js'
import VectorIndex from '../../models/VectorIndex.js'

export async function loadStore(repoId) {
  try {
    return await VectorIndex.find({ repoId }).lean()
  } catch {
    return []
  }
}

export async function indexFile(repoId, filename, content) {
  const embedding = await generateEmbedding(`File: ${filename}\n\n${content}`)

  await VectorIndex.findOneAndUpdate(
    { repoId, filename },
    {
      content: content.slice(0, 800), // Store more context for search results
      embedding,
      indexedAt: new Date()
    },
    { upsert: true, new: true }
  )
}

export async function indexMultipleFiles(repoId, files) {
  if (!files || files.length === 0) return 0

  const entries = await Promise.all(
    files.map(async (file) => {
      const embedding = await generateEmbedding(`File: ${file.name}\n\n${file.content}`)
      return {
        updateOne: {
          filter: { repoId, filename: file.name },
          update: {
            content: file.content.slice(0, 800),
            embedding,
            indexedAt: new Date()
          },
          upsert: true
        }
      }
    })
  )

  const result = await VectorIndex.bulkWrite(entries)
  return result.upsertedCount + result.modifiedCount
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
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] ** 2
    magB += b[i] ** 2
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB)
  return denominator === 0 ? 0 : dot / denominator
}
