import type { ButtonVariant } from '@/app/types';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  className?: string;
}

export default function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const baseStyles = "px-6 py-2.5 rounded-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-95 cursor-pointer text-sm md:text-base";
  const variantStyles = {
    primary: "bg-gradient-to-r from-ez-pink to-ez-purple text-white hover:brightness-110 shadow-lg shadow-ez-pink/15 hover:shadow-ez-pink/35 focus:ring-ez-pink",
    secondary: "bg-slate-900/80 text-slate-100 hover:text-white hover:bg-slate-800/80 border border-slate-800/80 hover:border-ez-pink/30 hover:shadow-md hover:shadow-ez-pink/5 focus:ring-slate-700",
  };

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}


