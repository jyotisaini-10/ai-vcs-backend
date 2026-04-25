import mongoose from 'mongoose'

const VectorIndexSchema = new mongoose.Schema({
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repo', required: true, index: true },
  filename: { type: String, required: true },
  content: String,
  embedding: [Number],
  indexedAt: { type: Date, default: Date.now }
})

// Unique per repo + filename to avoid duplicates
VectorIndexSchema.index({ repoId: 1, filename: 1 }, { unique: true })

export default mongoose.model('VectorIndex', VectorIndexSchema)
