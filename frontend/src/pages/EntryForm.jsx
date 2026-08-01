import { useState, useEffect } from 'react';
import { useNav } from '../nav.jsx';
import {
  useTools,
  useEntry,
  useCreateEntry,
  useUpdateEntry,
} from '../api.js';
import { Button, Input, Textarea, Select, Label, Card, Spinner } from '../components/ui.jsx';
import Markdown from '../components/Markdown.jsx';

const EMPTY = {
  toolMode: 'existing',
  tool_id: '',
  tool_name: '',
  title: '',
  command: '',
  purpose: '',
  tagsText: '',
  content: '',
};

export default function EntryForm({ id }) {
  const isEdit = !!id;
  const { navigate } = useNav();
  const { data: tools } = useTools();
  const { data: existing, isLoading } = useEntry(id);
  const create = useCreateEntry();
  const update = useUpdateEntry();

  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (isEdit && existing) {
      setForm({
        toolMode: 'existing',
        tool_id: String(existing.tool_id),
        tool_name: '',
        title: existing.title || '',
        command: existing.command || '',
        purpose: existing.purpose || '',
        tagsText: (existing.tags || []).join(', '),
        content: existing.content || '',
      });
    }
  }, [isEdit, existing]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!form.title.trim()) return;
    const tags = form.tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      title: form.title,
      command: form.command,
      purpose: form.purpose,
      content: form.content,
      tags,
    };
    if (form.toolMode === 'existing') {
      if (!form.tool_id) return;
      payload.tool_id = Number(form.tool_id);
    } else {
      if (!form.tool_name.trim()) return;
      payload.tool_name = form.tool_name.trim();
    }
    const res = isEdit
      ? await update.mutateAsync({ id, data: payload })
      : await create.mutateAsync(payload);
    navigate(`#/entry/${res.id}`);
  };

  if (isEdit && isLoading)
    return (
      <div className="py-20 text-center text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );

  const submitting = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(isEdit ? `#/entry/${id}` : '#/')}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        ← 取消
      </button>

      <h1 className="text-xl font-bold text-slate-900">
        {isEdit ? '编辑命令' : '新建命令'}
      </h1>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* 工具选择 */}
        <div>
          <Label>工具</Label>
          <div className="flex gap-2">
            <Select value={form.toolMode} onChange={set('toolMode')} className="w-32 shrink-0">
              <option value="existing">已有工具</option>
              <option value="new">新建工具</option>
            </Select>
            {form.toolMode === 'existing' ? (
              <Select value={form.tool_id} onChange={set('tool_id')} required>
                <option value="">选择工具…</option>
                {tools?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={form.tool_name}
                onChange={set('tool_name')}
                placeholder="新工具名，如 docker / kubectl"
                required
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>标题 *</Label>
            <Input
              value={form.title}
              onChange={set('title')}
              placeholder="如：删除远程分支"
              required
            />
          </div>
          <div>
            <Label>用途（简述）</Label>
            <Input
              value={form.purpose}
              onChange={set('purpose')}
              placeholder="如：删除远程仓库上的分支"
            />
          </div>
        </div>

        <div>
          <Label>命令</Label>
          <Input
            value={form.command}
            onChange={set('command')}
            placeholder="如：git push origin --delete <branch>"
            className="font-mono"
          />
        </div>

        <div>
          <Label>标签（逗号分隔）</Label>
          <Input
            value={form.tagsText}
            onChange={set('tagsText')}
            placeholder="如：branch, remote, 删除"
          />
        </div>

        {/* markdown 内容 + 实时预览 */}
        <div>
          <Label>详细说明（Markdown）</Label>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Textarea
              value={form.content}
              onChange={set('content')}
              rows={16}
              placeholder={'## 标题\n\n```bash\n命令示例\n```\n\n补充说明…'}
            />
            <Card className="min-h-[16rem] overflow-auto p-4">
              {form.content ? (
                <Markdown>{form.content}</Markdown>
              ) : (
                <p className="text-sm text-slate-300">实时预览…</p>
              )}
            </Card>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? '保存中…' : isEdit ? '保存修改' : '创建'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(isEdit ? `#/entry/${id}` : '#/')}
          >
            取消
          </Button>
        </div>
      </form>
    </div>
  );
}
