'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from 'react-aria-components';
import { portalLogout } from '@/app/(portal)/portal/login/actions';
import type { SchoolManagerContext } from '@/app/lib/onboarding/manager-auth';
import {
  HiOutlineAcademicCap,
  HiOutlineShieldCheck,
  HiArrowRightOnRectangle,
  HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';

interface PortalShellProps {
  children: React.ReactNode;
  context: SchoolManagerContext;
}

export default function PortalShell({ children, context }: PortalShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSchoolId = searchParams.get('schoolId') || context.managedSchools[0]?.schoolId;

  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSchoolId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set('schoolId', newSchoolId);
    router.push(`/portal?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[var(--surface-sunken)] text-[var(--foreground)] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[var(--surface-raised)]/90 backdrop-blur-md border-b border-[var(--line)] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="flex items-center gap-2 text-lg font-black tracking-tight text-white hover:opacity-90 transition-opacity"
            >
              <span className="text-[#f4cccc] font-extrabold">EZ</span>
              <span>ESPORTS</span>
            </Link>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#f4cccc]/15 text-[#f4cccc] border border-[#f4cccc]/30">
              Manager Portal
            </span>
          </div>

          {/* School Selector (if multiple managed schools or staff admin) */}
          <div className="flex-1 max-w-xs sm:max-w-sm">
            {context.managedSchools.length > 1 ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <HiOutlineAcademicCap className="w-4 h-4" />
                </div>
                <select
                  value={currentSchoolId || ''}
                  onChange={handleSchoolChange}
                  aria-label="Select School"
                  className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-[var(--surface)] border border-[var(--line)] rounded-lg text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#f4cccc] appearance-none"
                >
                  {context.managedSchools.map((s) => (
                    <option key={s.schoolId} value={s.schoolId} className="bg-zinc-900 text-white">
                      {s.schoolName}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-zinc-400 text-xs">
                  ▼
                </div>
              </div>
            ) : context.managedSchools[0] ? (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-300 font-semibold px-2 py-1 bg-zinc-900/60 rounded-lg border border-zinc-800">
                <HiOutlineAcademicCap className="w-4 h-4 text-[#f4cccc]" />
                <span className="truncate">{context.managedSchools[0].schoolName}</span>
              </div>
            ) : null}
          </div>

          {/* Right Header Navigation & User Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              target="_blank"
              className="hidden lg:inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span>Public Site</span>
              <HiOutlineArrowTopRightOnSquare className="w-3 h-3" />
            </Link>

            {/* User Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-zinc-200 truncate max-w-[140px]">
                  {context.email}
                </span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                  School Manager
                </span>
              </div>

              <form action={portalLogout}>
                <Button
                  type="submit"
                  aria-label="Sign out of School Manager Portal"
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                >
                  <HiArrowRightOnRectangle className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] py-4 text-center text-xs text-zinc-500">
        <p>EZ Esports School Manager Portal &bull; New York State Education Law § 2-D & FERPA Compliant</p>
      </footer>
    </div>
  );
}
