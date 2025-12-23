import Link from 'next/link';
import { SOCIAL_LINKS } from '@/app/lib/constants';

interface SocialBarProps {
  theme?: 'dark' | 'light';
}

function SocialIcon({ platform }: { platform: string }) {
  const getInitial = (platform: string): string => {
    const initials: Record<string, string> = {
      discord: 'D',
      instagram: 'I',
      twitter: 'T',
      facebook: 'F',
      youtube: 'Y',
      twitch: 'Tw',
      messenger: 'M',
    };
    return initials[platform.toLowerCase()] || platform[0].toUpperCase();
  };

  return (
    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white text-sm font-semibold hover:bg-gray-700 transition-colors">
      {getInitial(platform)}
    </div>
  );
}

export default function SocialBar({ theme = 'light' }: SocialBarProps) {
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';

  return (
    <section className={`${theme === 'dark' ? 'bg-gray-900' : 'bg-rose-50'} py-8`}>
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


