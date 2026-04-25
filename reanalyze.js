import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Commit from './models/Commit.js';
import { analyzeImpact, reviewCode, generateCommitMessage } from './services/ai/aiService.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find commits that failed analysis or have fallback messages
    const commits = await Commit.find({
      $or: [
        { impactSummary: 'Unable to analyze' },
        { impactSummary: '' },
        { aiStatus: 'failed' }
      ]
    });

    console.log(`Found ${commits.length} commits to re-analyze.`);

    for (const commit of commits) {
      console.log(`Analyzing commit: ${commit.sha.slice(0, 7)} - ${commit.message}`);
      
      // Construct diffs from stored filesChanged
      const diffs = (commit.filesChanged || []).map(f => ({
        file: f.filename,
        after: f.content || '',
        type: f.status || 'added'
      }));

      if (diffs.length === 0) {
        console.log(`Skipping ${commit.sha.slice(0, 7)}: No file content found in DB.`);
        continue;
      }

      try {
        const [aiMessage, reviewComments, impact] = await Promise.all([
          generateCommitMessage(diffs),
          reviewCode(diffs),
          analyzeImpact(diffs)
        ]);

        await Commit.findByIdAndUpdate(commit._id, {
          aiMessage,
          reviewComments,
          impactScore: impact.score,
          impactSummary: impact.summary,
          aiStatus: 'complete'
        });

        console.log(`✅ Successfully re-analyzed ${commit.sha.slice(0, 7)}`);
      } catch (err) {
        console.error(`❌ Failed to re-analyze ${commit.sha.slice(0, 7)}:`, err.message);
      }
    }

    console.log('Re-analysis complete.');
    process.exit(0);
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

run();
