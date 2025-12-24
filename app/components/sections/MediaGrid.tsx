import Image from 'next/image';
import type { Image as ImageType, Theme, GridColumns } from '@/app/types';
import { THEME_CLASSES, GRID_COLUMNS } from '@/app/lib/constants';

interface MediaGridProps {
  items: ImageType[];
  columns?: GridColumns;
  theme?: Theme;
}

export default function MediaGrid({ items, columns = 3, theme = 'dark' }: MediaGridProps) {
  const themeClasses = theme === 'dark' 
    ? `${THEME_CLASSES.dark.bg} ${THEME_CLASSES.dark.text}` 
    : `${THEME_CLASSES.light.bg} ${THEME_CLASSES.light.text}`;

  return (
    <section className={`${themeClasses} py-16 md:py-24`}>
      <div className="container mx-auto px-4">
        <div className={`grid ${GRID_COLUMNS[columns]} gap-4`}>
          {items.map((item, index) => (
            <div key={item.id || index} className="aspect-square rounded-lg overflow-hidden relative">
              <Image
                src={item.src}
                alt={item.alt}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


