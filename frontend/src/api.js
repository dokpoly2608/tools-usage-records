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
  history: (id) => req(`/entries/${id}/history`),
  // stats
  statsOverview: () => req('/stats'),
  statsTop: (limit) => req('/stats/top' + qs({ limit })),
  statsRecent: (limit) => req('/stats/recent' + qs({ limit })),
  statsByTool: () => req('/stats/by-tool'),
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

// ---------------- mutations ----------------
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['entries'] });
    qc.invalidateQueries({ queryKey: ['tools'] });
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

export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTool,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }),
  });
}
