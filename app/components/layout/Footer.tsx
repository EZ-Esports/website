import Link from 'next/link';
import { FOOTER_LINKS, SITE_CONFIG } from '@/app/lib/constants';
import SocialLinks from '@/app/components/ui/SocialLinks';

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
        <SocialLinks />
      </div>
    </footer>
  );
}

