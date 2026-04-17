import mongoose from 'mongoose'

const { Schema, model } = mongoose

const RepoSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      match: /^[a-zA-Z0-9_.-]+$/
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    collaborators: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['read', 'write'], default: 'read' }
      }
    ],
    description: {
      type: String,
      default: '',
      maxlength: 500
    },
    defaultBranch: {
      type: String,
      default: 'main'
    },
    branches: {
      type: [String],
      default: ['main']
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    language: {
      type: String,
      default: 'Unknown'
    },
    stars: {
      type: Number,
      default: 0
    },
    totalCommits: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
)

RepoSchema.index({ owner: 1, name: 1 }, { unique: true })

export default model('Repo', RepoSchema)
