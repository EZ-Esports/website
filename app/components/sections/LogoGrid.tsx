import Image from 'next/image';
import type { School, Theme } from '@/app/types';
import { THEME_CLASSES } from '@/app/lib/constants';

interface LogoGridProps {
  title: string;
  logos: School[];
  theme?: Theme;
}

export default function LogoGrid({ title, logos, theme = 'light' }: LogoGridProps) {
  const themeClasses = theme === 'dark' 
    ? `${THEME_CLASSES.dark.bg} ${THEME_CLASSES.dark.text}` 
    : `${THEME_CLASSES.light.bg} ${THEME_CLASSES.light.text}`;

  return (
    <section className={`${themeClasses} py-16 md:py-24`}>
      <div className="container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold mb-12 text-center">{title}</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-6">
          {logos.map((logo, index) => (
            <div key={logo.id || index} className="aspect-square rounded-full bg-white p-4 flex items-center justify-center">
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


