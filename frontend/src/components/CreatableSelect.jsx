import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '../lib/cn.js';

export default function CreatableSelect({
  options = [],
  value,
  onChange,
  placeholder = '选择或输入…',
  allowEmpty = false,
  emptyLabel = '（不选择）',
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const display = typeof value === 'string' ? value : '';

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const exactMatch = useMemo(
    () => query.trim() && options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase()),
    [options, query],
  );
  const isNew = query.trim() && !exactMatch;

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(-1);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const total = filtered.length + (isNew ? 1 : 0) + (allowEmpty ? 1 : 0);

  const selectExisting = (opt) => {
    onChange({ type: 'existing', value: opt.value, label: opt.label });
    setOpen(false);
  };

  const selectNew = () => {
    const name = query.trim();
    if (!name) return;
    onChange({ type: 'new', value: name, label: name });
    setOpen(false);
  };

  const selectEmpty = () => {
    onChange({ type: 'none' });
    setOpen(false);
  };

  const handleKey = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlight((h) => (h + 1) % (total || 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => (h <= 0 ? total - 1 : h - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlight === -1) {
          if (isNew) selectNew();
        } else {
          let idx = highlight;
          if (allowEmpty) {
            if (idx === 0) { selectEmpty(); return; }
            idx--;
          }
          if (idx < filtered.length) selectExisting(filtered[idx]);
          else selectNew();
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  };

  const itemCls = (active) =>
    cn(
      'px-3 py-1.5 text-sm cursor-pointer truncate',
      active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50',
    );

  let itemIdx = 0;
  const getIdx = () => itemIdx++;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center rounded-md border border-slate-300 bg-white px-3 text-sm',
          display ? 'text-slate-900' : 'text-slate-400',
          'hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
        )}
      >
        <span className="truncate">{display || placeholder}</span>
        <svg className="ml-auto h-4 w-4 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(-1); }}
              onKeyDown={handleKey}
              placeholder="输入搜索…"
              className="h-8 w-full rounded border-0 bg-slate-50 px-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {allowEmpty && (
              <li
                key="__empty"
                className={itemCls(highlight === getIdx())}
                onClick={selectEmpty}
                onMouseEnter={() => setHighlight(0)}
              >
                <span className="text-slate-400">{emptyLabel}</span>
              </li>
            )}
            {filtered.length === 0 && !isNew && (
              <li className="px-3 py-2 text-sm text-slate-400">无匹配项</li>
            )}
            {filtered.map((opt) => {
              const idx = getIdx();
              return (
                <li
                  key={opt.value}
                  className={itemCls(highlight === idx)}
                  onClick={() => selectExisting(opt)}
                  onMouseEnter={() => setHighlight(idx)}
                >
                  {opt.label}
                </li>
              );
            })}
            {isNew && (
              <li
                key="__new"
                className={itemCls(highlight === getIdx())}
                onClick={selectNew}
                onMouseEnter={() => setHighlight(filtered.length + (allowEmpty ? 1 : 0))}
              >
                <span className="text-indigo-600">＋ 新建「{query.trim()}」</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
