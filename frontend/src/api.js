import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

const BASE = '/api';

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // tools
  tools: () => req('/tools'),
  createTool: (d) => req('/tools', { method: 'POST', body: d }),
  deleteTool: (id) => req(`/tools/${id}`, { method: 'DELETE' }),
  // entries
  entries: (params) => req('/entries' + qs(params)),
  entry: (id) => req(`/entries/${id}`),
  createEntry: (d) => req('/entries', { method: 'POST', body: d }),
  updateEntry: (id, d) => req(`/entries/${id}`, { method: 'PUT', body: d }),
  deleteEntry: (id) => req(`/entries/${id}`, { method: 'DELETE' }),
  recordUse: (id, note) => req(`/entries/${id}/use`, { method: 'POST', body: { note: note || '' } }),
  copyEntry: (id) => req(`/entries/${id}/copy`, { method: 'POST' }),
  visitEntry: (id) => req(`/entries/${id}/visit`, { method: 'POST' }),
  history: (id) => req(`/entries/${id}/history`),
  // prompts
  prompts: (params) => req('/prompts' + qs(params)),
  prompt: (id) => req(`/prompts/${id}`),
  createPrompt: (d) => req('/prompts', { method: 'POST', body: d }),
  updatePrompt: (id, d) => req(`/prompts/${id}`, { method: 'PUT', body: d }),
  deletePrompt: (id) => req(`/prompts/${id}`, { method: 'DELETE' }),
  recordPromptUse: (id, note) => req(`/prompts/${id}/use`, { method: 'POST', body: { note: note || '' } }),
  copyPrompt: (id) => req(`/prompts/${id}/copy`, { method: 'POST' }),
  visitPrompt: (id) => req(`/prompts/${id}/visit`, { method: 'POST' }),
  promptHistory: (id) => req(`/prompts/${id}/history`),
  // categories
  categories: () => req('/categories'),
  createCategory: (d) => req('/categories', { method: 'POST', body: d }),
  updateCategory: (id, d) => req(`/categories/${id}`, { method: 'PUT', body: d }),
  deleteCategory: (id) => req(`/categories/${id}`, { method: 'DELETE' }),
  // stats
  statsOverview: () => req('/stats'),
  statsTop: (limit) => req('/stats/top' + qs({ limit })),
  statsRecent: (limit) => req('/stats/recent' + qs({ limit })),
  statsByTool: () => req('/stats/by-tool'),
  statsPromptsTop: (limit) => req('/stats/prompts/top' + qs({ limit })),
  statsPromptsRecent: (limit) => req('/stats/prompts/recent' + qs({ limit })),
};

// ---------------- queries ----------------
export function useTools() {
  return useQuery({ queryKey: ['tools'], queryFn: api.tools });
}

export function useEntries({ tool, q } = {}) {
  return useQuery({
    queryKey: ['entries', { tool: tool ?? null, q: q ?? '' }],
    queryFn: () => api.entries({ tool, q }),
  });
}

export function useEntry(id) {
  return useQuery({
    queryKey: ['entry', id],
    queryFn: () => api.entry(id),
    enabled: !!id,
  });
}

export function useHistory(id) {
  return useQuery({
    queryKey: ['history', id],
    queryFn: () => api.history(id),
    enabled: !!id,
  });
}

export function usePrompts({ category, source, q } = {}) {
  return useQuery({
    queryKey: ['prompts', { category: category ?? null, source: source ?? null, q: q ?? '' }],
    queryFn: () => api.prompts({ category, source, q }),
  });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: api.categories });
}

export function usePrompt(id) {
  return useQuery({
    queryKey: ['prompt', id],
    queryFn: () => api.prompt(id),
    enabled: !!id,
  });
}

export function usePromptHistory(id) {
  return useQuery({
    queryKey: ['prompt-history', id],
    queryFn: () => api.promptHistory(id),
    enabled: !!id,
  });
}

export function useStatsOverview() {
  return useQuery({ queryKey: ['stats', 'overview'], queryFn: api.statsOverview });
}
export function useStatsTop(limit = 15) {
  return useQuery({ queryKey: ['stats', 'top', limit], queryFn: () => api.statsTop(limit) });
}
export function useStatsRecent(limit = 30) {
  return useQuery({ queryKey: ['stats', 'recent', limit], queryFn: () => api.statsRecent(limit) });
}
export function useStatsByTool() {
  return useQuery({ queryKey: ['stats', 'by-tool'], queryFn: api.statsByTool });
}
export function useStatsPromptsTop(limit = 10) {
  return useQuery({ queryKey: ['stats', 'prompts-top', limit], queryFn: () => api.statsPromptsTop(limit) });
}
export function useStatsPromptsRecent(limit = 30) {
  return useQuery({ queryKey: ['stats', 'prompts-recent', limit], queryFn: () => api.statsPromptsRecent(limit) });
}

// ---------------- mutations ----------------
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['entries'] });
    qc.invalidateQueries({ queryKey: ['tools'] });
    qc.invalidateQueries({ queryKey: ['prompts'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };
}

export function useCreateEntry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: api.createEntry,
    onSuccess: invalidate,
  });
}

export function useUpdateEntry() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateEntry(id, data),
    onSuccess: (_data, { id }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['entry', id] });
    },
  });
}

export function useDeleteEntry() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: api.deleteEntry, onSuccess: invalidate });
}

export function useRecordUse() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }) => api.recordUse(id, note),
    onSuccess: (_data, { id }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['entry', id] });
      qc.invalidateQueries({ queryKey: ['history', id] });
    },
  });
}

export function useCopyEntry() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.copyEntry(id),
    onSuccess: (_data, id) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['entry', id] });
    },
  });
}

export function useVisitEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.visitEntry(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['entry', id] });
    },
  });
}

export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTool,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: api.deleteCategory, onSuccess: invalidate });
}

export function useCreatePrompt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: api.createPrompt,
    onSuccess: invalidate,
  });
}

export function useUpdatePrompt() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updatePrompt(id, data),
    onSuccess: (_data, { id }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['prompt', id] });
    },
  });
}

export function useDeletePrompt() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: api.deletePrompt, onSuccess: invalidate });
}

export function useRecordPromptUse() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }) => api.recordPromptUse(id, note),
    onSuccess: (_data, { id }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['prompt', id] });
      qc.invalidateQueries({ queryKey: ['prompt-history', id] });
    },
  });
}

export function useCopyPrompt() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.copyPrompt(id),
    onSuccess: (_data, id) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['prompt', id] });
    },
  });
}

export function useVisitPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.visitPrompt(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['prompt', id] });
    },
  });
}
