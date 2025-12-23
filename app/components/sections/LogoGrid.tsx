import Image from 'next/image';

interface LogoGridProps {
  title: string;
  logos: Array<{ name: string; logoUrl: string }>;
  theme?: 'dark' | 'light';
}

export default function LogoGrid({ title, logos, theme = 'light' }: LogoGridProps) {
  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white' 
    : 'bg-rose-50 text-gray-900';

  return (
    <section className={`${themeClasses} py-16 md:py-24`}>
      <div className="container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold mb-12 text-center">{title}</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-6">
          {logos.map((logo, index) => (
            <div key={index} className="aspect-square rounded-full bg-white p-4 flex items-center justify-center">
              <Image
                src={logo.logoUrl}
                alt={logo.name}
                width={200}
                height={200}
                className="object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


