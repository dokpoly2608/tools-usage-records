import {
  useStatsOverview,
  useStatsTop,
  useStatsByTool,
  useStatsRecent,
} from '../api.js';
import { useNav } from '../nav.jsx';
import { Card, Badge, Spinner } from '../components/ui.jsx';

function StatCard({ label, value, hint }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </Card>
  );
}

export default function StatsPage() {
  const { navigate } = useNav();
  const overview = useStatsOverview();
  const top = useStatsTop(15);
  const byTool = useStatsByTool();
  const recent = useStatsRecent(20);

  if (overview.isLoading)
    return (
      <div className="py-20 text-center text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );

  const o = overview.data || { entries: 0, tools: 0, usage: 0 };
  const maxUsage = Math.max(1, ...(top.data || []).map((x) => x.usage_count));

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-slate-800">使用统计</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="命令条目" value={o.entries} />
        <StatCard label="工具数" value={o.tools} />
        <StatCard label="累计使用" value={o.usage} hint="次记录" />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">🔥 高频命令</h2>
        {!top.data?.length ? (
          <p className="text-sm text-slate-400">
            还没有使用记录。在命令详情页点「记录本次使用」即可累计。
          </p>
        ) : (
          <ul className="space-y-2">
            {top.data.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => navigate(`#/entry/${e.id}`)}
                  className="w-full text-left"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">
                      <Badge className="mr-1.5 bg-indigo-50 text-indigo-700">{e.tool_name}</Badge>
                      {e.title}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-amber-600">
                      ⚡ {e.usage_count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(e.usage_count / maxUsage) * 100}%` }}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">按工具汇总</h2>
          {!byTool.data?.length ? (
            <p className="text-sm text-slate-400">暂无数据</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {byTool.data.map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="text-slate-700">{t.name}</span>
                  <span className="text-xs text-slate-400">
                    {t.entries} 条 · ⚡ {t.usage}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">最近使用</h2>
          {!recent.data?.length ? (
            <p className="text-sm text-slate-400">暂无记录</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {recent.data.map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-2">
                  <button
                    onClick={() => navigate(`#/entry/${r.entry_id}`)}
                    className="min-w-0 truncate text-left text-slate-700 hover:text-indigo-600"
                  >
                    <span className="text-slate-400">{r.tool_name}</span> {r.title}
                  </button>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(r.used_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
