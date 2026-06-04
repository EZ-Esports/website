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
    <section className={`${bgColor} py-8`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span className={`${textColor} text-sm font-medium`}>Follow us:</span>
          <SocialLinks
            className="flex justify-center items-center gap-4"
            iconClassName="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white hover:bg-gray-700 transition-colors"
          />
        </div>
      </div>
    </section>
  );
}


