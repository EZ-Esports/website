import Image from 'next/image';
import Link from 'next/link';
import type { Game, GameSlug } from '@/app/types';
import { getGameRoute } from '@/app/lib/constants';

interface GameShowcaseProps {
  title: string;
  games: Game[];
}

// Map game IDs to game slugs
const gameIdToSlug: Record<string, GameSlug> = {
  'lol': 'league-of-legends',
  'val': 'valorant',
  'tft': 'team-fight-tactics',
};

export default function GameShowcase({ title, games }: GameShowcaseProps) {
  return (
    <section className="bg-[#080c14] text-white py-20 md:py-28 border-t border-slate-900/60">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">{title}</h2>
          <div className="w-16 h-1 bg-gradient-to-r from-ez-pink to-ez-purple mx-auto rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {games.map((game, index) => {
            const gameSlug = game.id ? gameIdToSlug[game.id] : null;
            const href = gameSlug ? getGameRoute(gameSlug) : '#';
            
            const content = (
              <div
                className="aspect-video relative rounded-2xl overflow-hidden group cursor-pointer border border-slate-800/80 hover:border-ez-pink/40 shadow-xl shadow-black/45 hover:shadow-ez-pink/5 hover:scale-[1.03] transition-all duration-300"
                role="img"
                aria-label={`${game.title} game`}
              >
                <Image
                  src={game.imageUrl}
                  alt={game.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                {/* Overlay Vignette Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" aria-hidden="true" />
                <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col justify-end h-1/2">
                  <h3 className="text-white text-xl font-bold mb-2 tracking-tight drop-shadow-md">{game.title}</h3>
                  <div className="inline-flex items-center gap-1 text-ez-pink text-xs font-extrabold uppercase tracking-widest opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 transform sm:translate-y-2 sm:group-hover:translate-y-0">
                    Explore Game <span className="text-sm">→</span>
                  </div>
                </div>
              </div>
            );

            if (gameSlug) {
              return (
                <Link key={game.id || index} href={href} className="block">
                  {content}
                </Link>
              );
            }

            return (
              <div key={game.id || index} className="block">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

