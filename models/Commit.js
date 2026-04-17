import mongoose from 'mongoose'

const { Schema, model } = mongoose

const ReviewCommentSchema = new Schema({
  file: String,
  line: Number,
  comment: String,
  severity: {
    type: String,
    enum: ['info', 'warning', 'error'],
    default: 'info'
  }
})

const FileChangeSchema = new Schema({
  filename: String,
  status: { type: String, enum: ['added', 'modified', 'deleted'] },
  additions: { type: Number, default: 0 },
  deletions: { type: Number, default: 0 }
})

const CommitSchema = new Schema(
  {
    repoId: {
      type: Schema.Types.ObjectId,
      ref: 'Repo',
      required: true
    },
    sha: {
      type: String,
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true
    },
    aiMessage: {
      type: String,
      default: ''
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    branch: {
      type: String,
      default: 'main'
    },
    filesChanged: [FileChangeSchema],
    diff: {
      type: String,
      default: ''
    },
    reviewComments: [ReviewCommentSchema],
    impactScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    impactSummary: {
      type: String,
      default: ''
    },
    aiStatus: {
      type: String,
      enum: ['pending', 'complete', 'failed'],
      default: 'pending'
    }
  },
  { timestamps: true }
)

CommitSchema.index({ repoId: 1, createdAt: -1 })

export default model('Commit', CommitSchema)
