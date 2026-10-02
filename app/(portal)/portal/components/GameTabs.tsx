'use client';

export interface GameItem {
  id: string;
  slug: string;
  displayName: string;
  shortName: string;
}

interface GameTabsProps {
  games: GameItem[];
  selectedGame: string;
  onSelectGame: (gameId: string) => void;
}

export function GameTabs({ games, selectedGame, onSelectGame }: GameTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-800/80">
      <button
        onClick={() => onSelectGame('all')}
        className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
          selectedGame === 'all'
            ? 'bg-[#f4cccc] text-zinc-950 shadow-sm'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
        }`}
      >
        All Games
      </button>
      {games.map((g) => (
        <button
          key={g.id}
          onClick={() => onSelectGame(g.id)}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedGame === g.id
              ? 'bg-[#f4cccc] text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          {g.displayName}
        </button>
      ))}
    </div>
  );
}
