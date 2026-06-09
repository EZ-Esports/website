import type { Theme } from '@/app/types';
import { THEME_CLASSES } from '@/app/lib/constants';
import SocialLinks from '@/app/components/ui/SocialLinks';

interface SocialBarProps {
  theme?: Theme;
}

export default function SocialBar({ theme = 'light' }: SocialBarProps) {
  const textColor = theme === 'dark' ? THEME_CLASSES.dark.text : THEME_CLASSES.light.text;
  const bgColor = theme === 'dark' ? THEME_CLASSES.dark.bg : THEME_CLASSES.light.bg;

  return (
    <section className={`${bgColor} py-8 border-t-2 border-ez-pink/30`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span className={`${textColor} text-sm font-semibold tracking-wider uppercase`}>Follow us:</span>
          <SocialLinks
            className="flex justify-center items-center gap-4"
          />
        </div>
      </div>
    </section>
  );
}


