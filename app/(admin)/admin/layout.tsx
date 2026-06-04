import Link from 'next/link';
import { logout } from './actions';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const sidebarItems = [
    { label: 'Overview', href: '/admin', icon: '📊' },
    { label: 'Matches & Standings', href: '/admin/matches', icon: '🏆' },
    { label: 'News & Announcements', href: '/admin/news', icon: '📰' },
    { label: 'Roster Manager', href: '/admin/roster', icon: '👥' },
    { label: 'Public Site', href: '/', icon: '🌐' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex text-white">
      {/* Left Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="h-16 px-6 border-b border-gray-800 flex items-center justify-between">
          <Link href="/admin" className="font-extrabold text-xl tracking-tight text-white flex items-center gap-2">
            <span className="text-rose-500">EZ</span> Admin
          </Link>
          <span className="text-xs bg-rose-500/10 text-rose-300 font-semibold px-2 py-0.5 rounded border border-rose-500/20">
            CMS v1.0
          </span>
        </div>

        {/* Sidebar Items */}
        <nav className="flex-1 py-6 px-4 space-y-1">
          {sidebarItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors group"
            >
              <span className="text-lg group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-rose-900/20 hover:text-rose-300 border border-gray-700 hover:border-rose-900/30 text-gray-300 font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar */}
        <header className="h-16 border-b border-gray-800 bg-gray-900/50 flex items-center px-8 justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Dashboard Overview</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400 font-medium">Supabase Connected</span>
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
