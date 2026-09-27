import Link from 'next/link';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, Ref } from 'react';
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
  ref?: Ref<HTMLAnchorElement>;
};

type HTMLButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
  ref?: Ref<HTMLButtonElement>;
};

export type ButtonProps = LinkProps | HTMLButtonProps;

const baseStyles =
  'rounded-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface active:scale-95 cursor-pointer inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed';

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
  variant,
  size = "md",
  className = "",
  href,
  ref,
  ...props
}: ButtonProps) {
  const resolvedVariant = variant ?? (className ? undefined : 'primary');
  const combinedClassName = cx(
    resolvedVariant ? buttonClasses(resolvedVariant, size) : baseStyles,
    className
  );

  if (href) {
    const linkProps = props as Omit<LinkProps, keyof BaseProps | 'href' | 'ref'>;
    return (
      <Link
        href={href}
        ref={ref as Ref<HTMLAnchorElement>}
        className={combinedClassName}
        {...linkProps}
      >
        {children}
      </Link>
    );
  }

  const buttonProps = props as Omit<HTMLButtonProps, keyof BaseProps | 'href' | 'ref'>;
  const { type = 'button', ...restButtonProps } = buttonProps;
  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type={type}
      className={combinedClassName}
      {...restButtonProps}
    >
      {children}
    </button>
  );
}
