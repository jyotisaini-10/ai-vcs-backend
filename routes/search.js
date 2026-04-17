import express from 'express'
import { auth } from '../middleware/auth.js'
import { generateEmbedding } from '../services/ai/aiService.js'
import { searchStore } from '../services/storage/vectorStore.js'
import Groq from 'groq-sdk'
import dotenv from 'dotenv'
dotenv.config()

const router = express.Router()
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

router.post('/:id/search', auth, async (req, res, next) => {
  try {
    const { query } = req.body
    if (!query) return res.status(400).json({ message: 'Query is required' })

    const queryEmbedding = await generateEmbedding(query)
    const results = await searchStore(req.params.id, queryEmbedding, 8)

    if (results.length === 0) {
      return res.json({ results: [], answer: 'No indexed files found. Push some files first.' })
    }

    const context = results
      .slice(0, 4)
      .map((r) => `File: ${r.filename}\n\`\`\`\n${r.content}\n\`\`\``)
      .join('\n\n')

    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'You are a helpful code assistant. Answer questions about the codebase concisely.' },
        { role: 'user', content: `Based on this code:\n\n${context}\n\nQuestion: ${query}` }
      ]
    })

    res.json({
      results: results.map((r) => ({ filename: r.filename, score: r.score, snippet: r.content })),
      answer: result.choices[0].message.content.trim()
    })
  } catch (err) {
    next(err)
  }
})

export default router