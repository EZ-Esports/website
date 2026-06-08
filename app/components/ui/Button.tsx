import Link from 'next/link';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import type { ButtonVariant } from '@/app/types';

type BaseProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

type LinkProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

type HTMLButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
};

type ButtonProps = LinkProps | HTMLButtonProps;

export default function Button({
  children,
  variant = "primary",
  className = "",
  href,
  ...props
}: ButtonProps) {
  const baseStyles = "px-6 py-2.5 rounded-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background active:scale-95 cursor-pointer text-sm md:text-base inline-flex items-center justify-center";
  const variantStyles = {
    primary: "bg-ez-pink text-white hover:bg-rose-700 border border-transparent focus:ring-ez-pink/40",
    secondary: "bg-foreground text-background hover:opacity-90 border border-transparent focus:ring-foreground/40",
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${className}`;

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
