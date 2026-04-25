import express from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import User from '../models/User.js'
import { auth } from '../middleware/auth.js'

const router = express.Router()

// Configure Gmail Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' })
    }
    const user = await User.create({ username, email, password })
    const token = signToken(user._id)
    res.status(201).json({ user, token })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })
    const valid = await user.comparePassword(password)
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' })
    const token = signToken(user._id)
    res.json({ user, token })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user })
})

// PATCH /api/auth/profile
router.patch('/profile', auth, async (req, res, next) => {
  try {
    const { username, bio, location, website, currentPassword, newPassword } = req.body

    const user = await User.findById(req.user._id).select('+password')

    if (username && username !== user.username) {
      const exists = await User.findOne({ username, _id: { $ne: user._id } })
      if (exists) return res.status(400).json({ message: 'Username already taken' })
      user.username = username
    }

    if (bio !== undefined) user.bio = bio
    if (location !== undefined) user.location = location
    if (website !== undefined) user.website = website

    if (currentPassword && newPassword) {
      const valid = await user.comparePassword(currentPassword)
      if (!valid) return res.status(400).json({ message: 'Current password is incorrect' })
      if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' })
      user.password = newPassword
    }

    await user.save()
    res.json({ user })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' })

    const token = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex')
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000
    await user.save({ validateBeforeSave: false })

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`

    // 💡 Development Bypass: Always log the link to the console
    console.log('-----------------------------------------')
    console.log('🔑 PASSWORD RESET LINK (Check Console):')
    console.log(resetUrl)
    console.log('-----------------------------------------')

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Gmail credentials missing in .env. Link logged to console only.')
      return res.json({ message: 'Development mode: Reset link has been logged to the server console.' })
    }

    const mailOptions = {
      from: `"AI-VCS" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset Request — AI-VCS',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d1117;color:#e6edf3;border-radius:12px;border:1px solid #30363d;">
          <h2 style="color:#7c3aed;margin-bottom:8px;">🔐 Reset your password</h2>
          <p style="color:#8b949e;margin-bottom:24px;">You requested a password reset for your AI-VCS account.</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
          <p style="color:#8b949e;margin-top:24px;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          <hr style="border:none;border-top:1px solid #30363d;margin:20px 0;">
          <p style="color:#6e7681;font-size:12px;">Or copy this link: ${resetUrl}</p>
        </div>
      `
    }

    try {
      await transporter.sendMail(mailOptions)
      res.json({ message: 'If that email exists, a reset link has been sent to your inbox.' })
    } catch (error) {
      console.error('Gmail error:', error)
      res.json({ 
        message: 'Failed to send email, but the reset link has been logged to the SERVER TERMINAL for you.' 
      })
    }
  } catch (err) {
    console.error('Forgot password error:', err)
    res.status(500).json({ message: 'Failed to send reset email. Check server email config.' })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ message: 'Token and password required' })
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    })

    if (!user) return res.status(400).json({ message: 'Invalid or expired reset link' })

    user.password = password
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    await user.save()

    res.json({ message: 'Password reset successful! You can now sign in.' })
  } catch (err) {
    res.status(500).json({ message: 'Reset failed' })
  }
})

export default router
