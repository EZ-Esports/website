interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div 
      className={`bg-[#0d1321]/60 border border-slate-900 rounded-2xl p-6 transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}




