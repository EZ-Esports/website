import Link from 'next/link';
import { FOOTER_LINKS, SITE_CONFIG } from '@/app/lib/constants';
import SocialLinks from '@/app/components/ui/SocialLinks';

export default function Footer() {
  return (
    <footer className="bg-surface-sunken border-t border-line/80 text-foreground-secondary">
      <div className="container mx-auto px-4 py-12">
        {/* Powered by section */}
        <div className="text-center mb-6">
          <p className="text-sm tracking-wide font-medium text-foreground-muted">
            Powered by <span className="text-foreground font-bold hover:text-accent transition-colors">{SITE_CONFIG.company}</span>
          </p>
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-8 max-w-4xl mx-auto">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm hover:text-accent transition-all focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-surface-sunken rounded px-1 cursor-pointer"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div className="w-16 h-0.5 bg-line mx-auto mb-8 rounded-full" />

        {/* Social icons */}
        <SocialLinks />

        <p className="text-center text-xs text-foreground-secondary mt-6">© {new Date().getFullYear()} EZ Esports. All rights reserved.</p>
      </div>
    </footer>
  );
}

