import mongoose from 'mongoose'
const { Schema, model } = mongoose

const PullRequestSchema = new Schema({
  repoId: { type: Schema.Types.ObjectId, ref: 'Repo' },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['open', 'closed', 'merged'], default: 'open' },
  fromBranch: { type: String, default: 'feature' },
  toBranch: { type: String, default: 'main' },
  comments: [{
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    body: String,
    createdAt: { type: Date, default: Date.now }
  }],
  aiReview: { type: String, default: '' },
  aiStatus: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending' }
}, { timestamps: true })

export default model('PullRequest', PullRequestSchema)