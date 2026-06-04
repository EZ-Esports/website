import Link from 'next/link';
import { SiDiscord, SiInstagram, SiX, SiYoutube, SiTwitch } from 'react-icons/si';
import type { IconType } from 'react-icons';
import { SOCIAL_LINKS } from '@/app/lib/constants';
import type { SocialLink } from '@/app/types';

const PLATFORM_ICONS: Record<SocialLink['platform'], IconType> = {
  discord: SiDiscord,
  instagram: SiInstagram,
  twitter: SiX,
  youtube: SiYoutube,
  twitch: SiTwitch,
};

interface SocialLinksProps {
  className?: string;
  iconClassName?: string;
}

export default function SocialLinks({ className, iconClassName }: SocialLinksProps) {
  const iconStyles =
    iconClassName ??
    'w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white hover:bg-gray-700 transition-colors';

  return (
    <div className={className ?? 'flex justify-center items-center gap-4'}>
      {SOCIAL_LINKS.map((social) => {
        const Icon = PLATFORM_ICONS[social.platform];
        return (
          <Link
            key={social.platform}
            href={social.url}
            aria-label={social.label}
            className="focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-950 rounded-full"
          >
            <div className={iconStyles}>
              <Icon className="w-5 h-5" aria-hidden />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
