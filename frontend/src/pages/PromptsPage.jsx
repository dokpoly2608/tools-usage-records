import { useNav } from '../nav.jsx';
import { usePrompts, useCategories, useCopyPrompt } from '../api.js';
import { useDebounce } from '../lib/useDebounce.js';
import { Card, Badge, Button, Spinner, EmptyState } from '../components/ui.jsx';
import { extractVars } from '../components/TemplateModal.jsx';

const SOURCE_LABEL = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  manual: '手动',
};

export default function PromptsPage({ category, q }) {
  const { navigate } = useNav();
  const debounced = useDebounce(q, 250);
  const { data: prompts, isLoading } = usePrompts({ category, q: debounced });
  const { data: categories } = useCategories();
  const copyPrompt = useCopyPrompt();

  const handleCopy = (e, prompt) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(prompt.content);
    copyPrompt.mutate(prompt.id);
  };

  // 分类名：'0' = 未分类；正数 = 该分类；无 = 全部
  let title = '全部提示词';
  if (category === '0') title = '未分类提示词';
  else if (category) {
    const c = categories?.find((x) => String(x.id) === String(category));
    title = c ? c.name : '提示词';
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          {title}
          {debounced && (
            <span className="ml-2 text-sm font-normal text-slate-400">搜索 “{debounced}”</span>
          )}
        </h1>
        <span className="text-sm text-slate-400">{prompts?.length ?? 0} 条</span>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !prompts?.length ? (
        <EmptyState
          title={debounced ? '没有匹配的提示词' : '还没有任何提示词'}
          hint={debounced ? '换个关键词试试，或新建一条' : '点击右上角“新建”添加第一条提示词'}
          action={!debounced && <Button onClick={() => navigate('#/prompt-new')}>＋ 新建提示词</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {prompts.map((p) => {
            const vars = extractVars(p.content);
            return (
              <Card
                key={p.id}
                className="cursor-pointer p-4 transition hover:border-emerald-300 hover:shadow-md"
                onClick={() => navigate(`#/prompt/${p.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      {p.category_name && (
                        <Badge className="bg-teal-50 text-teal-700">{p.category_name}</Badge>
                      )}
                      <Badge className="bg-emerald-50 text-emerald-700">{SOURCE_LABEL[p.source] || p.source}</Badge>
                      {p.usage_count > 0 && (
                        <Badge className="bg-amber-50 text-amber-700" title="使用次数">⚡ {p.usage_count}</Badge>
                      )}
                      {p.copy_count > 0 && (
                        <Badge className="bg-cyan-50 text-cyan-700" title="复制次数">⧉ {p.copy_count}</Badge>
                      )}
                      {p.visit_count > 0 && (
                        <Badge className="bg-rose-50 text-rose-700" title="详情访问">👁 {p.visit_count}</Badge>
                      )}
                      {vars.length > 0 && (
                        <Badge className="bg-violet-50 text-violet-700" title="模板变量">⌗ {vars.join(', ')}</Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-slate-800">{p.title}</h3>
                    {p.purpose && <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{p.purpose}</p>}
                    {p.content && (
                      <p
                        className="mt-2 line-clamp-2 rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 cursor-pointer hover:bg-slate-200 active:bg-slate-300 transition-colors select-all"
                        title="点击复制提示词"
                        onClick={(ev) => handleCopy(ev, p)}
                      >
                        {p.content}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-slate-300">›</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
