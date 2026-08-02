import { useNav } from '../nav.jsx';
import { useEntries, useTools, useCopyEntry } from '../api.js';
import { useDebounce } from '../lib/useDebounce.js';
import { Card, Badge, Button, Spinner, EmptyState } from '../components/ui.jsx';

export default function HomePage({ toolId, q }) {
  const { navigate } = useNav();
  const debounced = useDebounce(q, 250);
  const { data: entries, isLoading } = useEntries({ tool: toolId, q: debounced });
  const { data: tools } = useTools();
  const copyEntry = useCopyEntry();

  const toolName = toolId ? tools?.find((t) => t.id === toolId)?.name : null;

  const handleCopy = (e, entry) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(entry.command);
    copyEntry.mutate(entry.id);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          {toolName || '全部命令'}
          {debounced && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              搜索 “{debounced}”
            </span>
          )}
        </h1>
        <span className="text-sm text-slate-400">{entries?.length ?? 0} 条</span>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !entries?.length ? (
        <EmptyState
          title={debounced ? '没有匹配的命令' : '还没有任何命令'}
          hint={
            debounced
              ? '换个关键词试试，或新建一条'
              : '点击右上角“新建”添加第一条命令用法'
          }
          action={
            !debounced && (
              <Button onClick={() => navigate('#/new')}>＋ 新建命令</Button>
            )
          }
        />
      ) : (
        <div className="space-y-2.5">
          {entries.map((e) => (
            <Card
              key={e.id}
              className="cursor-pointer p-4 transition hover:border-indigo-300 hover:shadow-md"
              onClick={() => navigate(`#/entry/${e.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge className="bg-indigo-50 text-indigo-700">{e.tool_name}</Badge>
                    {e.usage_count > 0 && (
                      <Badge className="bg-amber-50 text-amber-700" title="使用次数">
                        ⚡ {e.usage_count}
                      </Badge>
                    )}
                    {e.copy_count > 0 && (
                      <Badge className="bg-cyan-50 text-cyan-700" title="复制次数">
                        ⧉ {e.copy_count}
                      </Badge>
                    )}
                    {e.visit_count > 0 && (
                      <Badge className="bg-rose-50 text-rose-700" title="详情访问">
                        👁 {e.visit_count}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-medium text-slate-800">{e.title}</h3>
                  {e.purpose && (
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{e.purpose}</p>
                  )}
                  {e.command && (
                    <code
                      className="mt-2 block truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 cursor-pointer hover:bg-slate-200 active:bg-slate-300 transition-colors select-all"
                      title="点击复制命令"
                      onClick={(ev) => handleCopy(ev, e)}
                    >
                      {e.command}
                    </code>
                  )}
                  {e.tags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-slate-300">›</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
