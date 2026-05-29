import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, apiUpload } from '../lib/api';

interface Job {
  id: string;
  input: {
    source: 'github' | 'zip';
    githubUrl?: string;
    branch?: string;
    zipFileName?: string;
    rootPath?: string;
    startCommand?: string;
    routeHints?: string[];
    mode: 'low-fi' | 'high-fi' | 'both';
  };
  status: string;
  stages: Array<{
    name: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    error?: string;
    warnings: string[];
    logFile?: string;
  }>;
  workspace?: {
    path: string;
    packageManager?: string;
    framework?: string;
    entryPoint?: string;
    buildCommand?: string;
    devCommand?: string;
    outputDir?: string;
    detectedRoutes: string[];
  };
  routes: string[];
  artifacts: string[];
  errorSummary?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export function useJobs() {
  return useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => apiGet('/jobs'),
    refetchInterval: 5000,
  });
}

export function useJob(id: string | undefined) {
  return useQuery<Job>({
    queryKey: ['jobs', id],
    queryFn: () => apiGet(`/jobs/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return 3000;
      if (['completed', 'failed', 'cancelled'].includes(job.status)) return false;
      return 2000;
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      source: 'github' | 'zip';
      githubUrl?: string;
      branch?: string;
      rootPath?: string;
      startCommand?: string;
      routeHints?: string[];
      mode?: string;
    }) => apiPost<Job>('/jobs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUploadZip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, params }: { file: File; params?: Record<string, string> }) =>
      apiUpload<Job>('/upload/zip', file, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useRetryStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, stage }: { jobId: string; stage: string }) =>
      apiPost(`/jobs/${jobId}/retry/${stage}`),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs', jobId] });
    },
  });
}

export function useJobArtifacts(jobId: string | undefined) {
  return useQuery<Array<{ filename: string; sizeBytes: number; createdAt: string }>>({
    queryKey: ['artifacts', jobId],
    queryFn: () => apiGet(`/artifacts/${jobId}`),
    enabled: !!jobId,
  });
}

export function useJobLogs(jobId: string | undefined) {
  return useQuery<Record<string, string>>({
    queryKey: ['logs', jobId],
    queryFn: () => apiGet(`/logs/${jobId}`),
    enabled: !!jobId,
  });
}
