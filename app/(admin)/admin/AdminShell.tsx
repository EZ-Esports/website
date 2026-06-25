'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from './actions';
import SessionWarning from '@/app/components/admin/SessionWarning';
import {
  HiOutlineChartBar,
  HiOutlineTrophy,
  HiOutlineNewspaper,
  HiOutlineUsers,
  HiOutlineUserGroup,
  HiOutlinePhoto,
  HiOutlineCurrencyDollar,
  HiOutlineAcademicCap,
  HiOutlineClipboardDocument,
  HiOutlinePencilSquare,
  HiOutlineGlobeAlt,
  HiOutlineCog6Tooth,
  HiOutlineShieldCheck,
  HiArrowRightOnRectangle,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';

interface AdminShellProps {
  children: React.ReactNode;
  allowedHrefs: string[];
}

interface SidebarItem {
  label: string;
  href: string;
  icon: IconType;
}

export default function AdminShell({ children, allowedHrefs }: AdminShellProps) {
  const pathname = usePathname();

  const sidebarItems: SidebarItem[] = [
    { label: 'Overview', href: '/admin', icon: HiOutlineChartBar },
    { label: 'League Setup', href: '/admin/league', icon: HiOutlineCog6Tooth },
    { label: 'Matches & Standings', href: '/admin/matches', icon: HiOutlineTrophy },
    { label: 'Teams & Rosters', href: '/admin/roster', icon: HiOutlineUsers },
    { label: 'News & Announcements', href: '/admin/news', icon: HiOutlineNewspaper },
    { label: 'Leadership Manager', href: '/admin/leadership', icon: HiOutlineUserGroup },
    { label: 'Gallery', href: '/admin/gallery', icon: HiOutlinePhoto },
    { label: 'Sponsors', href: '/admin/sponsors', icon: HiOutlineCurrencyDollar },
    { label: 'Schools', href: '/admin/schools', icon: HiOutlineAcademicCap },
    { label: 'Applications', href: '/admin/applications', icon: HiOutlineClipboardDocument },
    { label: 'Page Content', href: '/admin/content', icon: HiOutlinePencilSquare },
    { label: 'EZ Staff', href: '/admin/team', icon: HiOutlineShieldCheck },
  ].filter(item => allowedHrefs.includes(item.href));

  // Helper to determine the current page title, including nested routes
  const getPageTitle = () => {
    if (pathname === '/admin/news/new') return 'New Article';
    if (pathname.startsWith('/admin/news/')) return 'Edit Article';
    if (pathname.startsWith('/admin/gallery')) return 'Gallery';
    if (pathname.startsWith('/admin/sponsors')) return 'Sponsors';
    if (pathname.startsWith('/admin/schools')) return 'Schools';
    if (pathname.startsWith('/admin/applications')) return 'Applications';
    if (pathname.startsWith('/admin/content')) return 'Page Content';
    if (pathname.startsWith('/admin/league')) return 'League Setup';

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
          <Link href="/admin" className="font-extrabold text-xl tracking-tight flex items-center gap-2 cursor-pointer hover:opacity-90">
            <span className="text-ez-pink font-extrabold">EZ</span>
            <span className="text-white font-extrabold">Admin</span>
          </Link>
        </div>

        {/* Sidebar Items */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {sidebarItems.map((item) => {
            const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 py-2.5 rounded-xl transition-all duration-300 group cursor-pointer border-l-2 pl-3 px-4 ${
                  isActive
                    ? 'bg-ez-pink/5 text-white border-ez-pink font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50 border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'text-ez-pink scale-110' : 'group-hover:scale-110'}`} />
                <span className="text-sm tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Public Site link — separated from admin nav */}
        <div className="px-3 pb-3 border-b border-zinc-800">
          <Link
            href="/"
            className="flex items-center gap-3 py-2.5 border-l-2 border-transparent pl-3 px-4 text-slate-400 hover:text-white hover:bg-slate-900/50 rounded-xl transition-all duration-300 text-sm tracking-wide"
          >
            <HiOutlineGlobeAlt className="w-5 h-5" />
            <span>Public Site</span>
          </Link>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/20">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 hover:text-white border border-zinc-800/80 hover:border-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-lg transition-all duration-300 cursor-pointer"
            >
              <HiArrowRightOnRectangle className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-zinc-800 bg-[#111111]/40 backdrop-blur-md flex items-center px-8 justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-ez-pink" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">{getPageTitle()}</h2>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
      <SessionWarning />
    </div>
  );
}
