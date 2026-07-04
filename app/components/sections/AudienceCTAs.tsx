import Link from 'next/link';

export default function AudienceCTAs() {
  return (
    <section className="bg-background py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Students & Fans */}
          <Link
            href="/valorant"
            className="flex-1 flex items-center gap-4 p-5 rounded-2xl border border-white/8 bg-black/20 hover:bg-black/35 backdrop-blur-md hover:border-ez-pink/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 group cursor-pointer shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-ez-pink/15 flex items-center justify-center shrink-0 border border-ez-pink/20">
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
              <div className="font-bold text-white text-sm tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Students &amp; Fans</div>
              <div className="text-slate-200/90 text-sm mt-0.5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.4)]">View Valorant, LoL, &amp; TFT leagues &amp; schedules</div>
            </div>
            <span className="text-ez-pink text-lg opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" aria-hidden="true">→</span>
          </Link>

          {/* School Admins & Parents */}
          <Link
            href="/apply"
            className="flex-1 flex items-center gap-4 p-5 rounded-2xl border border-white/8 bg-black/20 hover:bg-black/35 backdrop-blur-md hover:border-ez-pink/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 group cursor-pointer shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-ez-pink/15 flex items-center justify-center shrink-0 border border-ez-pink/20">
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
              <div className="font-bold text-white text-sm tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">School Admins &amp; Parents</div>
              <div className="text-slate-200/90 text-sm mt-0.5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.4)]">Bring EZ to your school</div>
            </div>
            <span className="text-ez-pink text-lg opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" aria-hidden="true">→</span>
          </Link>

          {/* Sponsors & Partners */}
          <Link
            href="/sponsors"
            className="flex-1 flex items-center gap-4 p-5 rounded-2xl border border-white/8 bg-black/20 hover:bg-black/35 backdrop-blur-md hover:border-ez-pink/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 group cursor-pointer shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-ez-pink/15 flex items-center justify-center shrink-0 border border-ez-pink/20">
              {/* Handshake icon */}
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ez-pink">
                <path d="M2 12l5-3 4 2 4-2 5 3" />
                <path d="M2 12v4l5 3 4-2 4 2 5-3v-4" />
                <path d="M11 14l-4-2" />
                <path d="M13 14l4-2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-sm tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Sponsors &amp; Partners</div>
              <div className="text-slate-200/90 text-sm mt-0.5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.4)]">Work with us</div>
            </div>
            <span className="text-ez-pink text-lg opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
