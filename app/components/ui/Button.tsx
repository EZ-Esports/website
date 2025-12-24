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
  const baseStyles = "px-6 py-3 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantStyles = {
    primary: "bg-rose-300 text-gray-900 hover:bg-rose-400 focus:ring-rose-500",
    secondary: "bg-gray-800 text-white hover:bg-gray-700 focus:ring-gray-500 border border-gray-700",
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


