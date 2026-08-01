import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav.jsx';
import { useTools, useCategories, useCreateCategory } from '../api.js';
import { cn } from '../lib/cn.js';
import { Button } from './ui.jsx';

export default function Layout({ children }) {
  const { navigate, view, query, setQuery, promptMode } = useNav();
  const { data: tools, isLoading } = useTools();
  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const searchRef = useRef(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // 按 "/" 聚焦搜索框
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSearchChange = (v) => {
    setQuery(v);
    // 在非列表页输入时，跳回当前模式列表以展示搜索结果
    const listPages = promptMode
      ? ['prompts']
      : ['home', 'tool'];
    if (v && !listPages.includes(view.name)) {
      navigate(promptMode ? '#/prompts' : '#/', { replace: true });
    }
  };

  const submitNewCat = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await createCategory.mutateAsync({ name: newCatName.trim() });
    setNewCatName('');
    setNewCatOpen(false);
  };

  // 当前选中的分类 id（字符串比较）
  const activeCat = view.cat ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* 侧边栏 */}
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-300">
        <div className="border-b border-slate-800 px-4 py-4">
          <button onClick={() => navigate('#/')} className="flex items-center gap-2 text-left">
            <span className="text-xl leading-none">⌘</span>
            <div>
              <div className="text-sm font-semibold text-white">命令用法知识库</div>
              <div className="text-[11px] text-slate-400">cmd usage kb</div>
            </div>
          </button>
        </div>

        {/* 命令 / 提示词 切换 */}
        <div className="flex gap-1 px-2 pt-3">
          <button
            onClick={() => navigate('#/')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              !promptMode ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800',
            )}
          >
            🔍 命令
          </button>
          <button
            onClick={() => navigate('#/prompts')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              promptMode ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800',
            )}
          >
            ✍ 提示词
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {!promptMode ? (
            <>
              <SideItem active={view.name === 'home'} onClick={() => navigate('#/')}>
                <span>全部命令</span>
              </SideItem>
              <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                工具
              </div>
              {isLoading && <div className="px-3 py-1 text-xs text-slate-500">加载中…</div>}
              {tools?.map((t) => {
                const active = view.name === 'tool' && view.id === t.id;
                return (
                  <SideItem key={t.id} active={active} onClick={() => navigate(`#/tool/${t.id}`)}>
                    <span className="truncate">{t.name}</span>
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
                      {t.usage > 0 && <span title="累计使用次数">⚡{t.usage}</span>}
                      <span className={cn('rounded px-1.5', active ? 'bg-white/20' : 'bg-slate-800')}>
                        {t.entry_count}
                      </span>
                    </span>
                  </SideItem>
                );
              })}
            </>
          ) : (
            <>
              <SideItem active={view.name === 'prompts' && activeCat === null} onClick={() => navigate('#/prompts')}>
                <span>全部提示词</span>
              </SideItem>
              <SideItem active={view.name === 'prompts' && activeCat === '0'} onClick={() => navigate('#/prompts?cat=0')}>
                <span className="italic text-slate-400">未分类</span>
                <span className="ml-auto text-[11px] text-slate-400">
                  {countUncategorized(categories)}
                </span>
              </SideItem>
              <div className="flex items-center justify-between px-3 pb-1 pt-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">分类</span>
              </div>
              {categories?.map((c) => {
                const active = view.name === 'prompts' && String(activeCat) === String(c.id);
                return (
                  <SideItem key={c.id} active={active} onClick={() => navigate(`#/prompts?cat=${c.id}`)}>
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
                      {c.usage > 0 && <span title="累计使用次数">⚡{c.usage}</span>}
                      <span className={cn('rounded px-1.5', active ? 'bg-white/20' : 'bg-slate-800')}>
                        {c.entry_count}
                      </span>
                    </span>
                  </SideItem>
                );
              })}
              {/* 新建分类 */}
              {newCatOpen ? (
                <form onSubmit={submitNewCat} className="px-1 py-1">
                  <input
                    autoFocus
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onBlur={() => !newCatName && setNewCatOpen(false)}
                    placeholder="分类名…"
                    className="h-8 w-full rounded border border-slate-600 bg-slate-800 px-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  onClick={() => setNewCatOpen(true)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-emerald-300 hover:bg-slate-800"
                >
                  <span>＋ 新建分类</span>
                </button>
              )}
            </>
          )}
        </nav>

        <div className="space-y-0.5 border-t border-slate-800 p-2">
          <SideItem active={view.name === 'stats'} onClick={() => navigate('#/stats')}>
            <span>📊 统计</span>
          </SideItem>
          {!promptMode ? (
            <SideItem onClick={() => navigate('#/new')}>
              <span className="text-indigo-300">＋ 新建命令</span>
            </SideItem>
          ) : (
            <SideItem onClick={() => navigate('#/prompt-new')}>
              <span className="text-emerald-300">＋ 新建提示词</span>
            </SideItem>
          )}
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <div className="relative max-w-2xl flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={promptMode ? '搜索提示词 / 用途 / 标签…   (按 / 聚焦)' : '搜索命令 / 用途 / 内容 / 标签…   (按 / 聚焦)'}
              className="h-9 w-full rounded-md border border-slate-300 bg-slate-50 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-slate-400 hover:text-slate-600"
                aria-label="清除搜索"
              >
                ✕
              </button>
            )}
          </div>
          <Button onClick={() => navigate(promptMode ? '#/prompt-new' : '#/new')}>＋ 新建</Button>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function countUncategorized(categories) {
  // 未分类计数 = 总提示词数 - 已分类数（粗略，需 stats；这里用 categories 汇总反推不可得，留空）
  return null;
}

function SideItem({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800',
      )}
    >
      {children}
    </button>
  );
}
