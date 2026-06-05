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
    { label: 'Roster Manager', href: '/admin/roster', icon: '👥' },
    { label: 'Leadership Manager', href: '/admin/leadership', icon: '👔' },
    { label: 'Public Site', href: '/', icon: '🌐' },
  ];

  // Helper to determine the current page title
  const getPageTitle = () => {
    const current = sidebarItems.find(item => item.href === pathname);
    return current ? current.label : 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-[#080c14] flex text-slate-100 font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#0b0f19] border-r border-slate-900 flex flex-col shrink-0 z-20">
        {/* Sidebar Header */}
        <div className="h-16 px-6 border-b border-slate-900 flex items-center justify-between">
          <Link href="/admin" className="font-extrabold text-xl tracking-tight text-white flex items-center gap-2 cursor-pointer hover:opacity-90">
            <span className="text-white font-extrabold">EZ Admin</span>
          </Link>
          <span className="text-[10px] bg-slate-900 text-slate-450 font-bold px-2 py-0.5 rounded border border-slate-800 uppercase tracking-wider">
            CMS v1.0
          </span>
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
        <div className="p-4 border-t border-slate-900 bg-slate-950/20">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800/80 hover:border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-lg transition-all duration-300 cursor-pointer"
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
        <header className="h-16 border-b border-slate-900 bg-[#080c14]/40 backdrop-blur-md flex items-center px-8 justify-between z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">{getPageTitle()}</h2>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1 bg-slate-900/60 rounded-full border border-slate-850">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider select-none">Database Connected</span>
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
