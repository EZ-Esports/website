interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div 
      className={`bg-background-secondary/65 border border-custom-border/70 rounded-2xl p-6 transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}




