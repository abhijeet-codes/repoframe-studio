import { config } from 'dotenv';
config();

import { runPipeline } from './pipeline/runner.js';

const jobId = process.argv[2] || process.env.JOB_ID;

if (!jobId) {
  console.error('[worker] No job ID provided');
  process.exit(1);
}

console.log(`[worker] Starting pipeline for job ${jobId}`);

runPipeline(jobId)
  .then(() => {
    console.log(`[worker] Pipeline completed for job ${jobId}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[worker] Pipeline failed for job ${jobId}:`, err.message);
    process.exit(1);
  });
