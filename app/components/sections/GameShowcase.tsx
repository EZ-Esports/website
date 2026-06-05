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
    <section className="bg-[#080c14] text-white py-16 md:py-24 border-t border-slate-900/40">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {games.map((game, index) => {
            const gameSlug = game.id ? gameIdToSlug[game.id] : null;
            const href = gameSlug ? getGameRoute(gameSlug) : '#';
            
            const content = (
              <div
                className="aspect-video relative rounded-xl overflow-hidden group cursor-pointer border border-slate-900 transition-all duration-200"
                role="img"
                aria-label={`${game.title} game`}
              >
                <Image
                  src={game.imageUrl}
                  alt={game.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Overlay Vignette Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" aria-hidden="true" />
                <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col justify-end h-1/2">
                  <h3 className="text-white text-lg font-bold mb-1 tracking-tight">{game.title}</h3>
                  <div className="inline-flex items-center gap-1 text-ez-pink text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-200">
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

