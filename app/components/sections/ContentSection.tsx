import Image from 'next/image';
import type { Theme, ImagePosition } from '@/app/types';
import { THEME_CLASSES } from '@/app/lib/constants';

interface ContentSectionProps {
  heading: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  imagePosition?: ImagePosition;
  theme?: Theme;
  children?: React.ReactNode;
}

export default function ContentSection({
  heading,
  description,
  imageSrc,
  imageAlt,
  imagePosition = 'right',
  theme = 'dark',
  children,
}: ContentSectionProps) {
  const themeClasses = theme === 'dark' 
    ? `${THEME_CLASSES.dark.bg} ${THEME_CLASSES.dark.text}` 
    : `${THEME_CLASSES.light.bg} ${THEME_CLASSES.light.text}`;

  const imageElement = imageSrc ? (
    <div key="image" className="relative w-full aspect-video rounded-lg overflow-hidden">
      <Image
        src={imageSrc}
        alt={imageAlt || heading}
        fill
        className="object-cover"
      />
    </div>
  ) : null;

  const contentOrder = imagePosition === 'left' 
    ? [imageElement, <div key="content">{children || <p className="text-lg leading-relaxed">{description}</p>}</div>]
    : [<div key="content">{children || <p className="text-lg leading-relaxed">{description}</p>}</div>, imageElement];

  const hasImage = !!imageSrc;
  const hasCustomContent = !!children;
  const isTextOnly = !hasImage && !hasCustomContent;
  const shouldUseGrid = hasImage && (hasCustomContent || description);

  return (
    <section className={`${themeClasses} py-16 md:py-24 relative z-10`}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white uppercase">{heading}</h2>
        </div>
        
        {isTextOnly ? (
          <div className="max-w-4xl mx-auto text-slate-300">
            <p className="text-base sm:text-lg leading-relaxed text-center">{description}</p>
          </div>
        ) : shouldUseGrid ? (
          <div className="grid md:grid-cols-2 gap-12 items-center text-slate-300">
            {contentOrder}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto text-slate-300">
            {children || <p className="text-base sm:text-lg leading-relaxed text-center">{description}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

