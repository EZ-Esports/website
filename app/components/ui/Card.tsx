interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div 
      className={`bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-xl p-6 hover:border-ez-pink/30 hover:shadow-xl hover:shadow-ez-pink/[0.03] transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
}




