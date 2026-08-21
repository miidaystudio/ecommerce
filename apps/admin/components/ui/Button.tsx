import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'danger';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-admin-accent text-white hover:opacity-90',
  danger: 'bg-danger text-white hover:opacity-90',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-admin-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-text-disabled disabled:text-white ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}
