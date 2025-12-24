import Link from 'next/link';
import type { Theme } from '@/app/types';
import { SOCIAL_LINKS, THEME_CLASSES } from '@/app/lib/constants';
import { getSocialIconInitial } from '@/app/lib/utils';

interface SocialBarProps {
  theme?: Theme;
}

function SocialIcon({ platform }: { platform: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white text-sm font-semibold hover:bg-gray-700 transition-colors">
      {getSocialIconInitial(platform)}
    </div>
  );
}

export default function SocialBar({ theme = 'light' }: SocialBarProps) {
  const textColor = theme === 'dark' ? THEME_CLASSES.dark.text : THEME_CLASSES.light.text;
  const bgColor = theme === 'dark' ? THEME_CLASSES.dark.bg : THEME_CLASSES.light.bg;

  return (
    <section className={`${bgColor} py-8`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span className={`${textColor} text-sm font-medium`}>Follow us:</span>
          {SOCIAL_LINKS.map((social) => (
            <Link
              key={social.platform}
              href={social.url}
              aria-label={social.label}
              className="focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 rounded-full"
            >
              <SocialIcon platform={social.platform} />
            </Link>
          ))}
          <span className={`${textColor} text-sm font-medium ml-4`}>Our broadcast</span>
        </div>
      </div>
    </section>
  );
}


