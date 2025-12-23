import Link from 'next/link';
import { FOOTER_LINKS, SOCIAL_LINKS, SITE_CONFIG } from '@/app/lib/constants';

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

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="container mx-auto px-4 py-12">
        {/* Powered by section */}
        <div className="text-center mb-8">
          <p className="text-sm">Powered by {SITE_CONFIG.company}</p>
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-950 rounded"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Social icons */}
        <div className="flex justify-center items-center gap-4">
          {SOCIAL_LINKS.map((social) => (
            <Link
              key={social.platform}
              href={social.url}
              aria-label={social.label}
              className="focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-950 rounded-full"
            >
              <SocialIcon platform={social.platform} />
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

