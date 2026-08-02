import { useState, useEffect, useRef } from 'react';
import { useNav } from '../nav.jsx';
import {
  usePrompt,
  usePromptHistory,
  useRecordPromptUse,
  useDeletePrompt,
  useCopyPrompt,
  useVisitPrompt,
} from '../api.js';
import { Button, Badge, Card, Spinner } from '../components/ui.jsx';
import Markdown from '../components/Markdown.jsx';
import TemplateModal from '../components/TemplateModal.jsx';

const SOURCE_LABEL = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  manual: '手动',
};

export default function PromptView({ id }) {
  const { navigate } = useNav();
  const { data: p, isLoading } = usePrompt(id);
  const { data: history } = usePromptHistory(id);
  const recordUse = useRecordPromptUse();
  const del = useDeletePrompt();
  const copyPrompt = useCopyPrompt();
  const visitPrompt = useVisitPrompt();
  const [tplOpen, setTplOpen] = useState(false);
  const visitedRef = useRef(false);

  // 详情页停留超过 3 秒记录一次访问
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!visitedRef.current) {
        visitedRef.current = true;
        visitPrompt.mutate(id);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading)
    return (
      <div className="py-20 text-center text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  if (!p) return <div className="py-20 text-center text-slate-400">未找到该提示词</div>;

  const onDelete = async () => {
    if (!confirm(`确认删除「${p.title}」？此操作不可恢复。`)) return;
    await del.mutateAsync(p.id);
    navigate('#/prompts');
  };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('#/prompts')} className="text-sm text-slate-500 hover:text-slate-700">
        ← 返回列表
      </button>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {p.category_name && (
            <Badge className="bg-teal-50 text-teal-700">{p.category_name}</Badge>
          )}
          <Badge className="bg-emerald-50 text-emerald-700">{SOURCE_LABEL[p.source] || p.source}</Badge>
          {p.usage_count > 0 && <Badge className="bg-amber-50 text-amber-700">⚡ 使用 {p.usage_count} 次</Badge>}
          {p.copy_count > 0 && (
            <Badge className="bg-cyan-50 text-cyan-700">⧉ 复制 {p.copy_count} 次</Badge>
          )}
          {p.visit_count > 0 && (
            <Badge className="bg-rose-50 text-rose-700">👁 访问 {p.visit_count} 次</Badge>
          )}
          {p.tags?.map((t) => (
            <Badge key={t} className="bg-slate-100 text-slate-600">#{t}</Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{p.title}</h1>
        {p.purpose && <p className="mt-1 text-slate-500">{p.purpose}</p>}
      </div>

      {p.content && (
        <Card className="p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">提示词</span>
            <Button variant="subtle" size="sm" onClick={() => setTplOpen(true)}>⌗ 套模板</Button>
          </div>
          <pre className="overflow-x-auto rounded bg-slate-900 p-3 font-mono text-sm text-slate-100 whitespace-pre-wrap break-all">
            <code>{p.content}</code>
          </pre>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => recordUse.mutate({ id: p.id })} disabled={recordUse.isPending}>
          {recordUse.isPending ? '记录中…' : '⚡ 记录本次使用'}
        </Button>
        <Button variant="outline" onClick={() => navigate(`#/prompt-edit/${p.id}`)}>✎ 编辑</Button>
        <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onDelete} disabled={del.isPending}>
          删除
        </Button>
      </div>

      {p.content && (
        <Card className="p-5">
          <Markdown>{p.content}</Markdown>
        </Card>
      )}

      {history?.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">使用历史（最近 {history.length} 次）</h3>
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline gap-2 text-sm">
                <span className="shrink-0 text-slate-400">{new Date(h.used_at).toLocaleString()}</span>
                {h.note && <span className="text-slate-600">— {h.note}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <TemplateModal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        text={p.content}
        variables={p.variables}
        label="提示词"
        onCopy={() => copyPrompt.mutate(p.id)}
      />
    </div>
  );
}
