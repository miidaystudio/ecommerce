import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className = '', children, ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-text-primary">
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        className={`h-11 rounded border bg-background px-3.5 text-base text-text-primary outline-none transition focus:border-primary ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
});
