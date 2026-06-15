import Link from 'next/link';

export default function AudienceCTAs() {
  return (
    <section className="bg-background py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Students & Fans */}
          <Link
            href="/valorant"
            className="flex-1 flex items-center gap-4 p-6 rounded-xl border border-ez-pink/25 hover:border-ez-pink/60 hover:bg-ez-pink/8 active:scale-[0.98] active:bg-ez-pink/12 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-ez-pink/20 flex items-center justify-center shrink-0">
              {/* Game controller icon */}
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ez-pink">
                <rect x="2" y="6" width="20" height="12" rx="3" />
                <path d="M8 12h4" />
                <path d="M10 10v4" />
                <circle cx="16" cy="11" r="0.5" fill="currentColor" />
                <circle cx="18" cy="13" r="0.5" fill="currentColor" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground text-sm tracking-wide">Students &amp; Fans</div>
              <div className="text-foreground-secondary text-sm mt-0.5">View Valorant league &amp; schedule</div>
            </div>
            <span className="text-ez-pink text-lg opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" aria-hidden="true">→</span>
          </Link>

          {/* School Admins & Parents */}
          <Link
            href="/apply"
            className="flex-1 flex items-center gap-4 p-6 rounded-xl border border-ez-pink/25 hover:border-ez-pink/60 hover:bg-ez-pink/8 active:scale-[0.98] active:bg-ez-pink/12 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-ez-pink/20 flex items-center justify-center shrink-0">
              {/* School building icon */}
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ez-pink">
                <path d="M3 21V9l9-6 9 6v12" />
                <path d="M9 21v-6h6v6" />
                <path d="M12 3v3" />
                <rect x="9" y="9" width="2" height="2" />
                <rect x="13" y="9" width="2" height="2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground text-sm tracking-wide">School Admins &amp; Parents</div>
              <div className="text-foreground-secondary text-sm mt-0.5">Bring EZ to your school</div>
            </div>
            <span className="text-ez-pink text-lg opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" aria-hidden="true">→</span>
          </Link>

          {/* Sponsors & Partners */}
          <Link
            href="/sponsors"
            className="flex-1 flex items-center gap-4 p-6 rounded-xl border border-ez-pink/25 hover:border-ez-pink/60 hover:bg-ez-pink/8 active:scale-[0.98] active:bg-ez-pink/12 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-ez-pink/20 flex items-center justify-center shrink-0">
              {/* Handshake icon */}
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ez-pink">
                <path d="M2 12l5-3 4 2 4-2 5 3" />
                <path d="M2 12v4l5 3 4-2 4 2 5-3v-4" />
                <path d="M11 14l-4-2" />
                <path d="M13 14l4-2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground text-sm tracking-wide">Sponsors &amp; Partners</div>
              <div className="text-foreground-secondary text-sm mt-0.5">Work with us</div>
            </div>
            <span className="text-ez-pink text-lg opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
