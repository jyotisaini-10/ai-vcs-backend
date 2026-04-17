import mongoose from 'mongoose'
const { Schema, model } = mongoose

const DiscussionSchema = new Schema({
  repoId: { type: Schema.Types.ObjectId, ref: 'Repo' },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  category: { type: String, enum: ['general', 'ideas', 'q&a', 'show', 'poll'], default: 'general' },
  pinned: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  votes: { type: Number, default: 0 },
  replies: [{
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    body: String,
    votes: { type: Number, default: 0 },
    isAnswer: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true })

export default model('Discussion', DiscussionSchema)