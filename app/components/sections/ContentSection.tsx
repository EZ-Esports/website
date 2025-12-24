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
    <section className={`${themeClasses} py-16 md:py-24`}>
      <div className="container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold mb-8 text-center">{heading}</h2>
        {isTextOnly ? (
          <div className="max-w-4xl mx-auto">
            <p className="text-lg leading-relaxed text-center">{description}</p>
          </div>
        ) : shouldUseGrid ? (
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {contentOrder}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {children || <p className="text-lg leading-relaxed text-center">{description}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

