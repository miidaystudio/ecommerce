import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'border border-border bg-transparent text-primary hover:border-primary/40',
  danger: 'bg-danger text-primary-foreground hover:opacity-90',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-muted-border disabled:bg-muted-border disabled:text-text-secondary ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}
