import Link from 'next/link';
import { FOOTER_LINKS, SITE_CONFIG } from '@/app/lib/constants';
import SocialLinks from '@/app/components/ui/SocialLinks';

export default function Footer() {
  return (
    <footer className="bg-[#04060a] border-t border-slate-900 text-slate-400">
      <div className="container mx-auto px-4 py-12">
        {/* Powered by section */}
        <div className="text-center mb-6">
          <p className="text-sm tracking-wide font-medium text-slate-500">
            Powered by <span className="text-slate-300 font-bold hover:text-ez-pink transition-colors">{SITE_CONFIG.company}</span>
          </p>
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-8 max-w-4xl mx-auto">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm hover:text-ez-pink transition-all focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:ring-offset-2 focus:ring-offset-[#04060a] rounded px-1 cursor-pointer"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div className="w-16 h-0.5 bg-slate-900 mx-auto mb-8 rounded-full" />

        {/* Social icons */}
        <SocialLinks />
      </div>
    </footer>
  );
}

