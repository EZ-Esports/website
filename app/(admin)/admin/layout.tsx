'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from './actions';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  const sidebarItems = [
    { label: 'Overview', href: '/admin', icon: '📊' },
    { label: 'Matches & Standings', href: '/admin/matches', icon: '🏆' },
    { label: 'News & Announcements', href: '/admin/news', icon: '📰' },
    { label: 'Teams & Rosters', href: '/admin/roster', icon: '👥' },
    { label: 'Leadership Manager', href: '/admin/leadership', icon: '👔' },
    { label: 'Public Site', href: '/', icon: '🌐' },
  ];

  // Helper to determine the current page title, including nested routes
  const getPageTitle = () => {
    if (pathname === '/admin/news/new') return 'New Article';
    if (pathname.startsWith('/admin/news/')) return 'Edit Article';

    // Pick the most specific sidebar item whose path prefixes the current route
    const match = sidebarItems
      .filter(item => item.href !== '/' && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0];

    return match ? match.label : 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-[#111111] flex text-zinc-100 font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#1a1a1a] border-r border-zinc-800 flex flex-col shrink-0 z-20">
        {/* Sidebar Header */}
        <div className="h-16 px-6 border-b border-zinc-800 flex items-center">
          <Link href="/admin" className="font-extrabold text-xl tracking-tight text-white flex items-center gap-2 cursor-pointer hover:opacity-90">
            <span className="text-white font-extrabold">EZ Admin</span>
          </Link>
        </div>


        {/* Sidebar Items */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 py-2.5 rounded-xl transition-all duration-300 group cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-l-2 border-white pl-3 px-4 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50 pl-4 px-4'
                }`}
              >
                <span className={`text-lg transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <span className="text-sm tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/20">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 hover:text-white border border-zinc-800/80 hover:border-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-lg transition-all duration-300 cursor-pointer"
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-zinc-800 bg-[#111111]/40 backdrop-blur-md flex items-center px-8 justify-between z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">{getPageTitle()}</h2>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
