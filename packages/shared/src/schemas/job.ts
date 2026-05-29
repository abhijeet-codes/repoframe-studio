import { z } from 'zod';

export const JobStatus = z.enum([
  'pending',
  'cloning',
  'extracting',
  'detecting',
  'installing',
  'building',
  'rendering',
  'analyzing',
  'generating',
  'completed',
  'failed',
  'cancelled',
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobInputSource = z.enum(['github', 'zip']);
export type JobInputSource = z.infer<typeof JobInputSource>;

export const WireframeMode = z.enum(['low-fi', 'high-fi', 'both']);
export type WireframeMode = z.infer<typeof WireframeMode>;

export const JobInputSchema = z.object({
  source: JobInputSource,
  githubUrl: z.string().url().optional(),
  branch: z.string().optional(),
  zipFileName: z.string().optional(),
  rootPath: z.string().optional(),
  startCommand: z.string().optional(),
  routeHints: z.array(z.string()).optional(),
  mode: WireframeMode.default('both'),
});
export type JobInput = z.infer<typeof JobInputSchema>;

export const PipelineStageStatus = z.enum(['pending', 'running', 'success', 'warning', 'failed', 'skipped']);
export type PipelineStageStatus = z.infer<typeof PipelineStageStatus>;

export const PipelineStageName = z.enum([
  'clone',
  'extract',
  'detect',
  'install',
  'build',
  'discover',
  'render',
  'analyze',
  'generate',
  'export',
]);
export type PipelineStageName = z.infer<typeof PipelineStageName>;

export const PipelineStageSchema = z.object({
  name: PipelineStageName,
  status: PipelineStageStatus,
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().optional(),
  error: z.string().optional(),
  warnings: z.array(z.string()).default([]),
  logFile: z.string().optional(),
});
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const WorkspaceInfoSchema = z.object({
  path: z.string(),
  packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun', 'unknown']).optional(),
  framework: z.string().optional(),
  entryPoint: z.string().optional(),
  buildCommand: z.string().optional(),
  devCommand: z.string().optional(),
  outputDir: z.string().optional(),
  detectedRoutes: z.array(z.string()).default([]),
});
export type WorkspaceInfo = z.infer<typeof WorkspaceInfoSchema>;

export const JobSchema = z.object({
  id: z.string().uuid(),
  input: JobInputSchema,
  status: JobStatus,
  stages: z.array(PipelineStageSchema),
  workspace: WorkspaceInfoSchema.optional(),
  routes: z.array(z.string()).default([]),
  artifacts: z.array(z.string()).default([]),
  errorSummary: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Job = z.infer<typeof JobSchema>;

export const CreateJobRequestSchema = z.object({
  source: JobInputSource,
  githubUrl: z.string().url().optional(),
  branch: z.string().optional(),
  rootPath: z.string().optional(),
  startCommand: z.string().optional(),
  routeHints: z.array(z.string()).optional(),
  mode: WireframeMode.default('both'),
});
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;
