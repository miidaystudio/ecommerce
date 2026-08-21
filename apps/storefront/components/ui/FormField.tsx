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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={`rounded-md border px-3 py-2 text-base text-text-primary outline-none focus:ring-2 focus:ring-primary ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
});
