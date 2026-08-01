import { useEffect, useRef } from 'react';
import { useNav } from '../nav.jsx';
import { useTools } from '../api.js';
import { cn } from '../lib/cn.js';
import { Button } from './ui.jsx';

export default function Layout({ children }) {
  const { navigate, view, query, setQuery } = useNav();
  const { data: tools, isLoading } = useTools();
  const searchRef = useRef(null);

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
    // 在非列表页输入时，跳回对应列表以展示搜索结果
    if (v && view.name !== 'home' && view.name !== 'tool' &&
        view.name !== 'prompts' && view.name !== 'prompt') {
      navigate('#/');
    }
  };

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

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          <SideItem active={view.name === 'home'} onClick={() => navigate('#/')}>
            <span>🔍 全部命令</span>
          </SideItem>
          <SideItem
            active={view.name === 'prompts' && !view.source}
            onClick={() => navigate('#/prompts')}
          >
            <span>✍ 全部提示词</span>
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
        </nav>

        <div className="space-y-0.5 border-t border-slate-800 p-2">
          <SideItem active={view.name === 'stats'} onClick={() => navigate('#/stats')}>
            <span>📊 统计</span>
          </SideItem>
          <SideItem onClick={() => navigate('#/new')}>
            <span className="text-indigo-300">＋ 新建命令</span>
          </SideItem>
          <SideItem onClick={() => navigate('#/prompt-new')}>
            <span className="text-emerald-300">＋ 新建提示词</span>
          </SideItem>
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
              placeholder="搜索命令 / 提示词 / 用途 / 标签…   (按 / 聚焦)"
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
          <Button onClick={() => navigate('#/new')}>＋ 新建</Button>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
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
