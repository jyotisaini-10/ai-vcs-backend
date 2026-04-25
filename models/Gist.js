import mongoose from 'mongoose'

const GistSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  language: { type: String, default: 'javascript' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublic: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.model('Gist', GistSchema)
