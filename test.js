import Groq from 'groq-sdk'
import dotenv from 'dotenv'
dotenv.config()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const res = await groq.chat.completions.create({
  model: 'llama3-8b-8192',
  max_tokens: 50,
  messages: [{ role: 'user', content: 'Say hello in one word' }]
})
console.log('Groq works:', res.choices[0].message.content)