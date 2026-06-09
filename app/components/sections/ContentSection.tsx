import Image from 'next/image';
import type { Theme, ImagePosition } from '@/app/types';
import { THEME_CLASSES } from '@/app/lib/constants';

interface ContentSectionProps {
  eyebrow?: string;
  heading: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  imagePosition?: ImagePosition;
  theme?: Theme;
  children?: React.ReactNode;
}

export default function ContentSection({
  eyebrow,
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

  const isDark = theme === 'dark';
  const headingColor = isDark ? 'text-white' : 'text-foreground';
  const textColor = isDark ? 'text-foreground' : 'text-foreground-secondary';

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
          {eyebrow && (
            <span className="inline-block text-ez-pink uppercase tracking-widest text-xs font-bold mb-3">{eyebrow}</span>
          )}
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight ${headingColor}`}>{heading}</h2>
          <div className="w-12 h-0.5 bg-gradient-to-r from-ez-pink to-ez-purple mx-auto mt-4" />
        </div>
        
        {isTextOnly ? (
          <div className={`max-w-4xl mx-auto ${textColor}`}>
            <p className="text-base sm:text-lg leading-relaxed text-center">{description}</p>
          </div>
        ) : shouldUseGrid ? (
          <div className={`grid md:grid-cols-2 gap-12 items-center ${textColor}`}>
            {contentOrder}
          </div>
        ) : (
          <div className={`max-w-4xl mx-auto ${textColor}`}>
            {children || <p className="text-base sm:text-lg leading-relaxed text-center">{description}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

