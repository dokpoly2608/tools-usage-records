import { useState, useEffect, useRef } from 'react';
import { useNav } from '../nav.jsx';
import {
  useEntry,
  useHistory,
  useRecordUse,
  useDeleteEntry,
  useCopyEntry,
  useVisitEntry,
} from '../api.js';
import { Button, Badge, Card, Spinner } from '../components/ui.jsx';
import Markdown from '../components/Markdown.jsx';
import TemplateModal from '../components/TemplateModal.jsx';

function CopyButton({ text, onCopy }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="subtle"
      size="sm"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
        onCopy?.();
      }}
    >
      {copied ? '已复制 ✓' : '⧉ 复制命令'}
    </Button>
  );
}

export default function EntryView({ id }) {
  const { navigate } = useNav();
  const { data: e, isLoading } = useEntry(id);
  const { data: history } = useHistory(id);
  const recordUse = useRecordUse();
  const del = useDeleteEntry();
  const copyEntry = useCopyEntry();
  const visitEntry = useVisitEntry();
  const [tplOpen, setTplOpen] = useState(false);
  const visitedRef = useRef(false);

  // 详情页停留超过 3 秒记录一次访问
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!visitedRef.current) {
        visitedRef.current = true;
        visitEntry.mutate(id);
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
  if (!e) return <div className="py-20 text-center text-slate-400">未找到该条目</div>;

  const onDelete = async () => {
    if (!confirm(`确认删除「${e.title}」？此操作不可恢复。`)) return;
    await del.mutateAsync(e.id);
    navigate('#/');
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('#/')}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        ← 返回列表
      </button>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge className="bg-indigo-50 text-indigo-700">{e.tool_name}</Badge>
          {e.usage_count > 0 && (
            <Badge className="bg-amber-50 text-amber-700">⚡ 使用 {e.usage_count} 次</Badge>
          )}
          {e.copy_count > 0 && (
            <Badge className="bg-cyan-50 text-cyan-700">⧉ 复制 {e.copy_count} 次</Badge>
          )}
          {e.visit_count > 0 && (
            <Badge className="bg-rose-50 text-rose-700">👁 访问 {e.visit_count} 次</Badge>
          )}
          {e.tags?.map((t) => (
            <Badge key={t} className="bg-slate-100 text-slate-600">
              #{t}
            </Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{e.title}</h1>
        {e.purpose && <p className="mt-1 text-slate-500">{e.purpose}</p>}
      </div>

      {e.command && (
        <Card className="p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">命令</span>
            <div className="flex gap-1.5">
              <Button variant="subtle" size="sm" onClick={() => setTplOpen(true)}>⌗ 套模板</Button>
              <CopyButton text={e.command} onCopy={() => copyEntry.mutate(e.id)} />
            </div>
          </div>
          <pre className="overflow-x-auto rounded bg-slate-900 p-3 font-mono text-sm text-slate-100">
            <code>{e.command}</code>
          </pre>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => recordUse.mutate({ id: e.id })}
          disabled={recordUse.isPending}
        >
          {recordUse.isPending ? '记录中…' : '⚡ 记录本次使用'}
        </Button>
        <Button variant="outline" onClick={() => navigate(`#/edit/${e.id}`)}>
          ✎ 编辑
        </Button>
        <Button
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          onClick={onDelete}
          disabled={del.isPending}
        >
          删除
        </Button>
      </div>

      {e.content && (
        <Card className="p-5">
          <Markdown>{e.content}</Markdown>
        </Card>
      )}

      {history?.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            使用历史（最近 {history.length} 次）
          </h3>
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline gap-2 text-sm">
                <span className="shrink-0 text-slate-400">
                  {new Date(h.used_at).toLocaleString()}
                </span>
                {h.note && <span className="text-slate-600">— {h.note}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <TemplateModal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        text={e.command}
        variables={e.variables}
        label="命令"
        onCopy={() => copyEntry.mutate(e.id)}
      />
    </div>
  );
}
