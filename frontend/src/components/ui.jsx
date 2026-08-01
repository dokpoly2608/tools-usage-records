import { cn } from '../lib/cn.js';

export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 select-none cursor-pointer';
  const variants = {
    default: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  };
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-9 px-4 text-sm',
    lg: 'h-10 px-5 text-base',
    icon: 'h-9 w-9',
    iconSm: 'h-7 w-7',
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, children, ...props }) {
  return (
    <label className={cn('block text-xs font-medium text-slate-600 mb-1', className)} {...props}>
      {children}
    </label>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }) {
  return (
    <div
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600',
        className,
      )}
    />
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center">
      <p className="text-slate-600 font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
