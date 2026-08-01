import { useState, useEffect, useMemo } from 'react';
import { useNav } from '../nav.jsx';
import { usePrompt, useCreatePrompt, useUpdatePrompt, useCategories } from '../api.js';
import { Button, Input, Textarea, Select, Label, Card, Spinner } from '../components/ui.jsx';
import Markdown from '../components/Markdown.jsx';
import { extractVars, renderTemplate } from '../components/TemplateModal.jsx';

const EMPTY = {
  title: '',
  purpose: '',
  source: 'manual',
  catMode: 'existing',
  category_id: '',
  category_name: '',
  tagsText: '',
  content: '',
  varDesc: {}, // name -> desc
};

export default function PromptForm({ id }) {
  const isEdit = !!id;
  const { navigate } = useNav();
  const { data: existing, isLoading } = usePrompt(id);
  const { data: categories } = useCategories();
  const create = useCreatePrompt();
  const update = useUpdatePrompt();

  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (isEdit && existing) {
      const varDesc = {};
      for (const v of existing.variables || []) varDesc[v.name] = v.desc || '';
      setForm({
        title: existing.title || '',
        purpose: existing.purpose || '',
        source: existing.source || 'manual',
        catMode: 'existing',
        category_id: existing.category_id ? String(existing.category_id) : '',
        category_name: '',
        tagsText: (existing.tags || []).join(', '),
        content: existing.content || '',
        varDesc,
      });
    }
  }, [isEdit, existing]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setVarDesc = (name) => (e) =>
    setForm((f) => ({ ...f, varDesc: { ...f.varDesc, [name]: e.target.value } }));

  // 从 content 自动检测变量
  const varNames = useMemo(() => extractVars(form.content), [form.content]);

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!form.title.trim()) return;
    const tags = form.tagsText.split(',').map((s) => s.trim()).filter(Boolean);
    const variables = varNames.map((name) => ({ name, desc: form.varDesc[name] || '', default: '' }));
    const payload = {
      title: form.title,
      purpose: form.purpose,
      source: form.source,
      content: form.content,
      tags,
      variables,
    };
    // 分类
    if (form.catMode === 'existing') {
      payload.category_id = form.category_id ? Number(form.category_id) : null;
    } else if (form.catMode === 'new') {
      payload.category_name = form.category_name.trim();
    } else if (form.catMode === 'none') {
      payload.category_id = null;
    }
    const res = isEdit
      ? await update.mutateAsync({ id, data: payload })
      : await create.mutateAsync(payload);
    navigate(`#/prompt/${res.id}`);
  };

  if (isEdit && isLoading)
    return (
      <div className="py-20 text-center text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );

  const submitting = create.isPending || update.isPending;
  const preview = renderTemplate(form.content, Object.fromEntries(varNames.map((n) => [n, form.varDesc[n] || ''])));

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(isEdit ? `#/prompt/${id}` : '#/prompts')} className="text-sm text-slate-500 hover:text-slate-700">
        ← 取消
      </button>

      <h1 className="text-xl font-bold text-slate-900">{isEdit ? '编辑提示词' : '新建提示词'}</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>标题 *</Label>
            <Input value={form.title} onChange={set('title')} placeholder="如：代码审查提示词" required />
          </div>
          <div>
            <Label>来源</Label>
            <Select value={form.source} onChange={set('source')}>
              <option value="manual">手动</option>
              <option value="claude-code">Claude Code</option>
              <option value="codex">Codex</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>用途（简述）</Label>
          <Input value={form.purpose} onChange={set('purpose')} placeholder="如：让 AI 审查一段代码的质量" />
        </div>

        {/* 分类选择 */}
        <div>
          <Label>分类</Label>
          <div className="flex gap-2">
            <Select value={form.catMode} onChange={set('catMode')} className="!w-32 !shrink-0">
              <option value="existing">已有分类</option>
              <option value="new">新建分类</option>
              <option value="none">不归类</option>
            </Select>
            {form.catMode === 'existing' ? (
              <Select value={form.category_id} onChange={set('category_id')}>
                <option value="">（不归类）</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            ) : form.catMode === 'new' ? (
              <Input
                value={form.category_name}
                onChange={set('category_name')}
                placeholder="新分类名，如：代码审查"
              />
            ) : (
              <Input disabled placeholder="该提示词不归入任何分类" />
            )}
          </div>
        </div>

        <div>
          <Label>标签（逗号分隔）</Label>
          <Input value={form.tagsText} onChange={set('tagsText')} placeholder="如：review, 代码质量" />
        </div>

        <div>
          <Label>提示词原文（Markdown，支持 {'{{变量}}'} 套模板）</Label>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Textarea
              value={form.content}
              onChange={set('content')}
              rows={14}
              placeholder={'请审查以下 {{language}} 代码：\n\n```\n{{code}}\n```\n\n关注 {{focus}} 方面。'}
            />
            <Card className="min-h-[14rem] overflow-auto p-4">
              {form.content ? <Markdown>{form.content}</Markdown> : <p className="text-sm text-slate-300">实时预览…</p>}
            </Card>
          </div>
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
            <p className="mt-2 text-xs text-slate-400">
              预览（变量未填值时保留标记）：{preview}
            </p>
          </Card>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? '保存中…' : isEdit ? '保存修改' : '创建'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(isEdit ? `#/prompt/${id}` : '#/prompts')}>
            取消
          </Button>
        </div>
      </form>
    </div>
  );
}
