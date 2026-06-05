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
    primary: "bg-ez-pink text-white hover:bg-rose-700 border border-transparent focus:ring-ez-pink/40",
    secondary: "bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-850 border border-slate-800/80 focus:ring-slate-700",
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


