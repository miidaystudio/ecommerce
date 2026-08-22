import { TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className = '', rows = 4, ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-text-primary">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={`rounded border px-3.5 py-2.5 text-base text-text-primary outline-none transition focus:border-primary ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
});
