import Groq from 'groq-sdk'
import dotenv from 'dotenv'
dotenv.config()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function truncate(str, maxLen = 4000) {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '\n... [truncated]'
}

// async function ask(prompt) {
//   const res = await groq.chat.completions.create({
//     model: 'llama-3.3-70b-versatile',
//     max_tokens: 1000,
//     messages: [{ role: 'user', content: prompt }]
//   })
//   return res.choices[0].message.content.trim()
// }
async function ask(prompt) {
    try {
        console.log("--- Sending Request to Groq ---");
        const res = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }]
        });

        if (!res.choices || res.choices.length === 0) {
            throw new Error("Groq returned an empty response.");
        }

        console.log("--- AI Analysis Complete ---");
        return res.choices[0].message.content.trim();

    } catch (error) {
        console.error("GROQ API ERROR:", error.message);
        // Return a fallback message so the UI doesn't stay stuck
        return "AI analysis unavailable at the moment."; 
    }
}

export async function generateCommitMessage(diffs) {
  const diffStr = diffs
    .map((d) => `File: ${d.file} (${d.type})\n${truncate(d.after, 1000)}`)
    .join('\n\n---\n\n')
  const text = await ask(
    `Write a conventional commit message for these code changes.
Reply with ONLY the commit message on one line. No explanation, no backticks, no quotes.

CHANGES:
${truncate(diffStr, 3000)}`
  )
  return text.split('\n')[0].trim()
}

export async function reviewCode(diffs) {
  if (!diffs || diffs.length === 0) return []
  const diffStr = diffs
    .map((d) => `### ${d.file}\n\`\`\`\n${truncate(d.after, 800)}\n\`\`\``)
    .join('\n\n')
  const text = await ask(
    `You are a code reviewer. Review this code and find bugs, security issues, and improvements.
Return ONLY a valid JSON array with no markdown, no explanation, no code fences.
Each item must have: {"file":"filename","line":N,"comment":"concise comment","severity":"info" or "warning" or "error"}
Return [] if no issues found.

CODE:
${truncate(diffStr, 3500)}`
  )
  try {
    const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim()
    const match = clean.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch { return [] }
}

export async function analyzeImpact(diffs) {
  const diffStr = diffs.map((d) => `File: ${d.file}\n${truncate(d.after, 600)}`).join('\n\n')
  const text = await ask(
    `Analyze the impact of these code changes.
Return ONLY valid JSON with no markdown, no explanation, no code fences:
{"score":N,"summary":"one sentence","risks":["risk1","risk2"]}
Score must be 1-10 where 1=trivial change, 10=critical breaking change.

CHANGES:
${truncate(diffStr, 2500)}`
  )
  try {
    const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { score: 5, summary: 'Unable to analyze', risks: [] }
  } catch { return { score: 5, summary: 'Unable to analyze', risks: [] } }
}

export async function resolveConflict({ base, ours, theirs, filename }) {
  return ask(
    `Resolve this merge conflict in ${filename}.
Return ONLY the resolved file content. No explanation, no conflict markers, no surrounding text.

BASE:
${truncate(base, 1000)}

OURS:
${truncate(ours, 1000)}

THEIRS:
${truncate(theirs, 1000)}`
  )
}

export async function generateEmbedding(text) {
  const words = truncate(text, 2000).toLowerCase().split(/\W+/).filter(Boolean)
  const freq = {}
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  const vocab = Object.keys(freq).slice(0, 384)
  const vec = new Array(384).fill(0)
  vocab.forEach((w, i) => { vec[i] = freq[w] / words.length })
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map(v => v / mag)
}

export async function explainCode(code, filename) {
  return ask(`Explain what this code in ${filename} does in 3-5 sentences for a developer:

\`\`\`
${truncate(code, 3000)}
\`\`\``)
}