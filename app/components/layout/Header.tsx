import Link from 'next/link';
import { SITE_CONFIG } from '@/app/lib/constants';
import Navigation from './Navigation';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800">
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-white text-xl font-bold hover:text-rose-300 transition-colors">
            {SITE_CONFIG.company}
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Navigation />
          </div>
        </div>
      </nav>
    </header>
  );
}
