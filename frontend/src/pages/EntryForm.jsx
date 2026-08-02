import { useState, useEffect, useMemo } from 'react';
import { useNav } from '../nav.jsx';
import {
  useTools,
  useEntry,
  useCreateEntry,
  useUpdateEntry,
} from '../api.js';
import { Button, Input, Textarea, Label, Card, Spinner } from '../components/ui.jsx';
import Markdown from '../components/Markdown.jsx';
import { extractVars } from '../components/TemplateModal.jsx';

import CreatableSelect from '../components/CreatableSelect.jsx';

const EMPTY = {
  tool_id: '',
  tool_name: '',
  title: '',
  command: '',
  purpose: '',
  tagsText: '',
  content: '',
  varDesc: {},
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
      const varDesc = {};
      for (const v of existing.variables || []) varDesc[v.name] = v.desc || '';
      setForm({
        tool_id: String(existing.tool_id),
        tool_name: '',
        title: existing.title || '',
        command: existing.command || '',
        purpose: existing.purpose || '',
        tagsText: (existing.tags || []).join(', '),
        content: existing.content || '',
        varDesc,
      });
    }
  }, [isEdit, existing]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setVarDesc = (name) => (e) =>
    setForm((f) => ({ ...f, varDesc: { ...f.varDesc, [name]: e.target.value } }));

  // 从 command 自动检测模板变量
  const varNames = useMemo(() => extractVars(form.command), [form.command]);

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!form.title.trim()) return;
    const tags = form.tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const variables = varNames.map((name) => ({ name, desc: form.varDesc[name] || '', default: '' }));
    const payload = {
      title: form.title,
      command: form.command,
      purpose: form.purpose,
      content: form.content,
      tags,
      variables,
    };
    if (form.tool_id) {
      payload.tool_id = Number(form.tool_id);
    } else if (form.tool_name.trim()) {
      payload.tool_name = form.tool_name.trim();
    } else {
      return;
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
          <CreatableSelect
            options={tools?.map((t) => ({ value: String(t.id), label: t.name })) || []}
            value={form.tool_id ? tools?.find((t) => String(t.id) === form.tool_id)?.name : form.tool_name || ''}
            onChange={(val) => {
              if (val.type === 'existing') {
                setForm((f) => ({ ...f, tool_id: val.value, tool_name: '' }));
              } else if (val.type === 'new') {
                setForm((f) => ({ ...f, tool_name: val.value, tool_id: '' }));
              }
            }}
            placeholder="选择或新建工具…"
          />
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
          <Label>命令（支持 {'{{变量}}'} 套模板，如 git push origin :{'{{branch}}'}）</Label>
          <Input
            value={form.command}
            onChange={set('command')}
            placeholder="如：git push origin --delete {{branch}}"
            className="font-mono"
          />
        </div>

        {varNames.length > 0 && (
          <Card className="p-4">
            <Label>检测到模板变量（可补充说明）</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {varNames.map((name) => (
                <div key={name}>
                  <span className="mb-1 block font-mono text-xs text-violet-700">{'{{' + name + '}}'}</span>
                  <Input
                    value={form.varDesc[name] || ''}
                    onChange={setVarDesc(name)}
                    placeholder={`说明 ${name} 是什么（可选）`}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

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
