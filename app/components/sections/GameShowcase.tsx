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
    <section className="bg-gray-900 text-white py-16 md:py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold mb-12 text-center">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {games.map((game, index) => {
            const gameSlug = game.id ? gameIdToSlug[game.id] : null;
            const href = gameSlug ? getGameRoute(gameSlug) : '#';
            
            const content = (
              <div
                className="aspect-video relative rounded-lg overflow-hidden group cursor-pointer"
                role="img"
                aria-label={`${game.title} game`}
              >
                <Image
                  src={game.imageUrl}
                  alt={game.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" aria-hidden="true" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white text-lg font-semibold mb-1">{game.title}</h3>
                  <div className="text-rose-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore →
                  </div>
                </div>
              </div>
            );

            if (gameSlug) {
              return (
                <Link key={game.id || index} href={href}>
                  {content}
                </Link>
              );
            }

            return (
              <div key={game.id || index}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

