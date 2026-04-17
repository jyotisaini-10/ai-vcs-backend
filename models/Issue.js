import mongoose from 'mongoose'
const { Schema, model } = mongoose

const IssueSchema = new Schema({
  repoId: { type: Schema.Types.ObjectId, ref: 'Repo' },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  label: { type: String, enum: ['bug', 'feature', 'enhancement', 'question', 'documentation'], default: 'bug' },
  comments: [{
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    body: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true })

export default model('Issue', IssueSchema)