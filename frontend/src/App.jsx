import { useState, useEffect, useCallback } from 'react';
import { NavContext } from './nav.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import EntryView from './pages/EntryView.jsx';
import EntryForm from './pages/EntryForm.jsx';
import PromptsPage from './pages/PromptsPage.jsx';
import PromptView from './pages/PromptView.jsx';
import PromptForm from './pages/PromptForm.jsx';
import StatsPage from './pages/StatsPage.jsx';

// hash 形如 "#/path?query"，拆成 path 与 search
function splitHash(hash) {
  const h = (hash || '#/').slice(1); // 去掉 '#'
  const i = h.indexOf('?');
  const path = i >= 0 ? h.slice(0, i) : h;
  const search = i >= 0 ? h.slice(i + 1) : '';
  return { path, search };
}

function parseRoute(hash) {
  const { path, search } = splitHash(hash);
  const params = new URLSearchParams(search);
  const q = params.get('q') || '';
  const cat = params.get('cat'); // 提示词分类 id；'0' = 未分类
  const source = params.get('source');
  const parts = path.split('/').filter(Boolean);

  const base = { q, cat, source, path };
  if (!parts.length) return { ...base, name: 'home' };
  if (parts[0] === 'stats') return { ...base, name: 'stats' };
  if (parts[0] === 'new') return { ...base, name: 'new' };
  if (parts[0] === 'tool' && parts[1]) return { ...base, name: 'tool', id: Number(parts[1]) };
  if (parts[0] === 'entry' && parts[1]) return { ...base, name: 'entry', id: Number(parts[1]) };
  if (parts[0] === 'edit' && parts[1]) return { ...base, name: 'edit', id: Number(parts[1]) };
  // 提示词
  if (parts[0] === 'prompts') return { ...base, name: 'prompts' };
  if (parts[0] === 'prompt-new') return { ...base, name: 'prompt-new' };
  if (parts[0] === 'prompt-edit' && parts[1]) return { ...base, name: 'prompt-edit', id: Number(parts[1]) };
  if (parts[0] === 'prompt' && parts[1]) return { ...base, name: 'prompt', id: Number(parts[1]) };
  return { ...base, name: 'home' };
}

// 判断是否处于「提示词模式」
function isPromptMode(view) {
  return ['prompts', 'prompt', 'prompt-new', 'prompt-edit'].includes(view.name);
}

export default function App() {
  const [hash, setHash] = useState(() => location.hash || '#/');

  useEffect(() => {
    const on = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // navigate(to, {replace})：to 可带 query；replace 时用 replaceState 不污染后退历史
  const navigate = useCallback((to, opts = {}) => {
    const t = to.startsWith('#') ? to : '#' + to;
    if (opts.replace) {
      history.replaceState(null, '', t);
      setHash(t);
    } else if (location.hash === t) {
      setHash(t); // 同 hash 强制刷新
    } else {
      location.hash = t;
    }
  }, []);

  const view = parseRoute(hash);
  const promptMode = isPromptMode(view);

  // query 来自 URL
  const query = view.q;
  const setQuery = useCallback(
    (v) => {
      // 在当前 path 上更新 ?q=，replace 不入历史
      const { path } = splitHash(location.hash);
      const params = new URLSearchParams();
      if (view.cat !== undefined && view.cat !== null) params.set('cat', view.cat);
      if (view.source) params.set('source', view.source);
      if (v) params.set('q', v);
      const qs = params.toString();
      navigate(`${path}${qs ? '?' + qs : ''}`, { replace: true });
    },
    [navigate, view.cat, view.source],
  );

  const ctx = { navigate, hash, view, query, setQuery, promptMode };

  return (
    <NavContext.Provider value={ctx}>
      <Layout>
        {view.name === 'home' && <HomePage key="home" q={view.q} />}
        {view.name === 'tool' && <HomePage key={`tool-${view.id}`} toolId={view.id} q={view.q} />}
        {view.name === 'entry' && <EntryView key={`e-${view.id}`} id={view.id} />}
        {view.name === 'new' && <EntryForm key="new" />}
        {view.name === 'edit' && <EntryForm key={`edit-${view.id}`} id={view.id} />}
        {view.name === 'prompts' && (
          <PromptsPage key={`prompts-${view.cat || 'all'}`} category={view.cat} q={view.q} />
        )}
        {view.name === 'prompt' && <PromptView key={`p-${view.id}`} id={view.id} />}
        {view.name === 'prompt-new' && <PromptForm key="prompt-new" />}
        {view.name === 'prompt-edit' && <PromptForm key={`pedit-${view.id}`} id={view.id} />}
        {view.name === 'stats' && <StatsPage key="stats" />}
      </Layout>
    </NavContext.Provider>
  );
}
