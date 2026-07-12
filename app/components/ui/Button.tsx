import Link from 'next/link';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import type { ButtonVariant, ButtonSize } from '@/app/types';
import { cx } from '@/app/lib/cx';

type BaseProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

type LinkProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

type HTMLButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
};

type ButtonProps = LinkProps | HTMLButtonProps;

const baseStyles =
  'rounded-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface active:scale-95 cursor-pointer inline-flex items-center justify-center';

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-1.5 text-xs md:text-sm',
  md: 'px-6 py-2.5 text-sm md:text-base',
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent/80 border border-transparent focus:ring-accent/40',
  secondary: 'bg-foreground text-surface hover:opacity-90 border border-transparent focus:ring-foreground/40',
  ghost: 'bg-transparent text-foreground hover:bg-surface-raised border border-transparent focus:ring-foreground/30',
  outline: 'bg-transparent text-foreground border border-line hover:border-accent/60 hover:bg-surface-raised focus:ring-accent/30',
};

/** Returns the class string for a given variant/size — consumed directly by admin surfaces (PR3). */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return cx(baseStyles, sizeStyles[size], variantStyles[variant]);
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  href,
  ...props
}: ButtonProps) {
  const combinedClassName = cx(buttonClasses(variant, size), className);

  if (href) {
    const linkProps = props as Omit<LinkProps, keyof BaseProps | 'href'>;
    return (
      <Link
        href={href}
        className={combinedClassName}
        {...linkProps}
      >
        {children}
      </Link>
    );
  }

  const buttonProps = props as Omit<HTMLButtonProps, keyof BaseProps | 'href'>;
  return (
    <button
      className={combinedClassName}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
