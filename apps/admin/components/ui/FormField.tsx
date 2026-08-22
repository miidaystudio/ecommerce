import { InputHTMLAttributes, forwardRef } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, id, className = '', ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-text-primary">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={`h-11 rounded border px-3.5 text-base text-text-primary outline-none transition focus:border-primary ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
});
