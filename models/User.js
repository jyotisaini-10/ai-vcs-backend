import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const { Schema, model } = mongoose

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    avatar: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: '',
      maxlength: 160
    },
    location: {
      type: String,
      default: '',
      maxlength: 60
    },
    website: {
      type: String,
      default: '',
      maxlength: 100
    },
    repos: [{ type: Schema.Types.ObjectId, ref: 'Repo' }],
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
  },
  { timestamps: true }
)

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

UserSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  return obj
}

export default model('User', UserSchema)
