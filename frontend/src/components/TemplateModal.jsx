import { useState, useMemo, useEffect } from 'react';
import { Button, Input, Label } from './ui.jsx';

// 从文本中提取 {{var}} 变量名（按首次出现顺序，去重）
export function extractVars(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  const re = /\{\{\s*([a-zA-Z_][\w-]*)\s*\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

// 用 values 渲染模板：有值则替换，空值保留原 {{name}} 标记
export function renderTemplate(text, values) {
  if (!text) return '';
  return text.replace(/\{\{\s*([a-zA-Z_][\w-]*)\s*\}\}/g, (full, name) => {
    const v = values?.[name];
    return v !== undefined && v !== '' ? v : full;
  });
}

// 套模板弹窗：命令与提示词共用
export default function TemplateModal({ open, onClose, text, variables = [], label = '内容' }) {
  const varNames = useMemo(() => extractVars(text), [text]);
  const varMeta = useMemo(() => {
    const map = {};
    for (const v of variables) map[v.name] = v;
    return map;
  }, [variables]);

  const [values, setValues] = useState({});

  // 打开时用 default 初始化
  useEffect(() => {
    if (!open) return;
    const init = {};
    for (const name of varNames) init[name] = varMeta[name]?.default || '';
    setValues(init);
  }, [open, varNames, varMeta]);

  if (!open) return null;

  const rendered = renderTemplate(text, values);
  const hasVars = varNames.length > 0;

  const copy = () => {
    navigator.clipboard?.writeText(rendered);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-800">套模板 · {label}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!hasVars ? (
            <p className="text-sm text-slate-500">
              该{label}没有 <code className="rounded bg-slate-100 px-1">{'{{变量}}'}</code> 标记，可直接复制原文。
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                填入变量值，预览结果可一键复制。用 <code className="rounded bg-slate-100 px-1">{'{{name}}'}</code> 在{label}中标记可填变量。
              </p>
              {varNames.map((name) => (
                <div key={name}>
                  <Label>
                    {name}
                    {varMeta[name]?.desc && (
                      <span className="ml-1 font-normal text-slate-400">— {varMeta[name].desc}</span>
                    )}
                  </Label>
                  <Input
                    value={values[name] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                    placeholder={varMeta[name]?.default || `输入 ${name}`}
                    autoFocus={name === varNames[0]}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Label>渲染结果</Label>
            <pre className="max-h-52 overflow-auto rounded bg-slate-900 p-3 font-mono text-sm text-slate-100 whitespace-pre-wrap break-all">
              <code>{rendered}</code>
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={copy}>⧉ 复制结果</Button>
        </div>
      </div>
    </div>
  );
}
