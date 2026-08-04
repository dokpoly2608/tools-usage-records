import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { copyText } from '../lib/clipboard.js';

// 从 React 子节点里递归取出纯文本，用于复制代码块
function nodeText(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (typeof node === 'object' && node.props) return nodeText(node.props.children);
  return '';
}

function PreWithCopy({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const text = nodeText(children);
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => {
          copyText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="absolute right-2 top-2 rounded bg-slate-700/80 px-2 py-0.5 text-xs text-slate-100 opacity-0 transition group-hover:opacity-100 hover:bg-slate-600"
      >
        {copied ? '已复制' : '复制'}
      </button>
      <pre {...props}>{children}</pre>
    </div>
  );
}

export default function Markdown({ children }) {
  return (
    <div className="prose-kb">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: PreWithCopy }}>
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
