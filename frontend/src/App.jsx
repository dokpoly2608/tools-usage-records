import { useState, useEffect, useCallback } from 'react';
import { NavContext } from './nav.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import EntryView from './pages/EntryView.jsx';
import EntryForm from './pages/EntryForm.jsx';
import StatsPage from './pages/StatsPage.jsx';

function parseRoute(route) {
  const parts = route.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'stats') return { name: 'stats' };
  if (parts[0] === 'new') return { name: 'new' };
  if (parts[0] === 'tool' && parts[1]) return { name: 'tool', id: Number(parts[1]) };
  if (parts[0] === 'entry' && parts[1]) return { name: 'entry', id: Number(parts[1]) };
  if (parts[0] === 'edit' && parts[1]) return { name: 'edit', id: Number(parts[1]) };
  return { name: 'home' };
}

export default function App() {
  const [route, setRoute] = useState(() => (location.hash || '#/').slice(1));

  useEffect(() => {
    const on = () => setRoute((location.hash || '#/').slice(1));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const navigate = useCallback((to) => {
    const t = to.startsWith('#') ? to : '#' + to;
    if (location.hash === t) {
      // 同一 hash 也强制刷新（如已在 home 再次点 全部）
      setRoute(t.slice(1));
    } else {
      location.hash = t;
    }
  }, []);

  const [query, setQuery] = useState('');
  const view = parseRoute(route);

  const ctx = { navigate, route, view, query, setQuery };

  return (
    <NavContext.Provider value={ctx}>
      <Layout>
        {view.name === 'home' && <HomePage key="home" />}
        {view.name === 'tool' && <HomePage key={`tool-${view.id}`} toolId={view.id} />}
        {view.name === 'entry' && <EntryView key={`e-${view.id}`} id={view.id} />}
        {view.name === 'new' && <EntryForm key="new" />}
        {view.name === 'edit' && <EntryForm key={`edit-${view.id}`} id={view.id} />}
        {view.name === 'stats' && <StatsPage key="stats" />}
      </Layout>
    </NavContext.Provider>
  );
}
