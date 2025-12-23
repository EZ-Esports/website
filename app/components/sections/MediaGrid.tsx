import Image from 'next/image';

interface MediaGridProps {
  items: Array<{ src: string; alt: string }>;
  columns?: 2 | 3 | 4 | 5;
  theme?: 'dark' | 'light';
}

export default function MediaGrid({ items, columns = 3, theme = 'dark' }: MediaGridProps) {
  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white' 
    : 'bg-rose-50 text-gray-900';

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
  };

  return (
    <section className={`${themeClasses} py-16 md:py-24`}>
      <div className="container mx-auto px-4">
        <div className={`grid ${gridCols[columns]} gap-4`}>
          {items.map((item, index) => (
            <div key={index} className="aspect-square rounded-lg overflow-hidden relative">
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


