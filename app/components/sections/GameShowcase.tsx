import Image from 'next/image';
import Link from 'next/link';
import type { Game, GameSlug } from '@/app/types';
import { getGameRoute } from '@/app/lib/constants';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';

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

// Map game IDs to their original banner dimensions
const gameDimensions: Record<string, { width: number; height: number }> = {
  'lol': { width: 850, height: 286 },
  'val': { width: 814, height: 276 },
  'tft': { width: 1080, height: 411 },
};

export default function GameShowcase({ title, games }: GameShowcaseProps) {
  return (
    <Section>
      <SectionHeader eyebrow="Competition" title={title} />
      <div className="flex flex-wrap justify-center gap-8">
        {games.map((game, index) => {
          const gameSlug = game.id ? gameIdToSlug[game.id] : null;
          const href = gameSlug ? getGameRoute(gameSlug) : '#';
          const dims = game.id ? gameDimensions[game.id] : { width: 800, height: 270 };

          const content = (
            <div
              className="relative rounded-xl overflow-hidden group cursor-pointer border border-line/80 hover:border-accent/60 transition-all duration-200 active:scale-[0.98]"
            >
              <Image
                src={game.imageUrl}
                alt={game.title}
                width={dims.width}
                height={dims.height}
                unoptimized
                className="w-full h-auto object-contain group-hover:scale-105 transition-transform duration-300"
              />
              {/* Overlay Vignette Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-sunken/80 via-surface-sunken/40 to-transparent" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex flex-col items-end justify-end">
                <h3 className="text-foreground text-base sm:text-lg font-bold tracking-tight text-right">{game.title}</h3>
                <div aria-hidden="true" className="inline-flex items-center gap-1 text-accent text-xs font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100 transition-all duration-200 text-right mt-1">
                  Explore Game <span className="text-sm">→</span>
                </div>
              </div>
            </div>
          );

          if (gameSlug) {
            return (
              <Link key={game.id || index} href={href} className="block w-full sm:w-[calc(50%_-_1rem)] lg:w-[calc(33.333%_-_1.333rem)]">
                {content}
              </Link>
            );
          }

          return (
            <div key={game.id || index} className="block w-full sm:w-[calc(50%_-_1rem)] lg:w-[calc(33.333%_-_1.333rem)]">
              {content}
            </div>
          );
        })}
      </div>
    </Section>
  );
}


