import Image from 'next/image';

interface ContentSectionProps {
  heading: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
  theme?: 'dark' | 'light';
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
    ? 'bg-gray-900 text-white' 
    : 'bg-rose-50 text-gray-900';

  const imageElement = imageSrc ? (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden">
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

