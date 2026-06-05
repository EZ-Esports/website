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
    'w-10 h-10 rounded-full bg-slate-900 border border-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-ez-pink/50 hover:bg-ez-pink/10 hover:scale-110 hover:shadow-lg hover:shadow-ez-pink/10 transition-all duration-300';

  return (
    <div className={className ?? 'flex justify-center items-center gap-4'}>
      {SOCIAL_LINKS.map((social) => {
        const Icon = PLATFORM_ICONS[social.platform];
        return (
          <Link
            key={social.platform}
            href={social.url}
            aria-label={social.label}
            className="focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-full"
          >
            <div className={iconStyles}>
              <Icon className="w-4.5 h-4.5" aria-hidden />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
