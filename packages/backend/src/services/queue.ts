import { fork, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

const queue: string[] = [];
let activeJobs = 0;
let workerProcess: ChildProcess | null = null;

function getWorkerPath(): string {
  // In dev, use tsx to run the worker directly
  return path.resolve(__dirname, '../../../worker/src/index.ts');
}

function processNext() {
  if (queue.length === 0 || activeJobs >= WORKER_CONCURRENCY) return;

  const jobId = queue.shift()!;
  activeJobs++;

  console.log(`[queue] Processing job ${jobId} (active: ${activeJobs}, queued: ${queue.length})`);

  const workerScript = getWorkerPath();
  const child = fork(workerScript, [jobId], {
    execArgv: ['--import', 'tsx'],
    env: { ...process.env, JOB_ID: jobId },
    stdio: 'pipe',
  });

  child.stdout?.on('data', (data) => {
    process.stdout.write(`[worker:${jobId.slice(0, 8)}] ${data}`);
  });

  child.stderr?.on('data', (data) => {
    process.stderr.write(`[worker:${jobId.slice(0, 8)}] ${data}`);
  });

  child.on('exit', (code) => {
    activeJobs--;
    console.log(`[queue] Job ${jobId} finished with code ${code} (active: ${activeJobs})`);
    processNext();
  });

  child.on('error', (err) => {
    activeJobs--;
    console.error(`[queue] Job ${jobId} worker error:`, err.message);
    processNext();
  });
}

export async function enqueueJob(jobId: string) {
  queue.push(jobId);
  console.log(`[queue] Enqueued job ${jobId} (queue length: ${queue.length})`);
  processNext();
}

export function getQueueStatus() {
  return {
    queued: queue.length,
    active: activeJobs,
    concurrency: WORKER_CONCURRENCY,
  };
}
