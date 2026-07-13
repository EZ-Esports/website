import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import LeagueSetupClient from './LeagueSetupClient';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';

async function getGamesAndSeasons() {
  const [games, seasons] = await Promise.all([
    db.select().from(schema.games).orderBy(schema.games.displayName),
    db.select().from(schema.seasons).orderBy(schema.seasons.gameId, schema.seasons.name),
  ]);
  return { games, seasons };
}

export default async function LeagueSetupPage() {
  let games: Awaited<ReturnType<typeof getGamesAndSeasons>>['games'] = [];
  let seasons: Awaited<ReturnType<typeof getGamesAndSeasons>>['seasons'] = [];
  let dbError = false;

  try {
    if (process.env.DATABASE_URL) {
      const res = await getGamesAndSeasons();
      games = res.games;
      seasons = res.seasons;
    } else {
      dbError = true;
    }
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-raised/30 border border-line border-l-4 border-l-accent rounded-2xl p-6">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">League Setup</h1>
        <p className="text-foreground-secondary text-xs mt-1.5 leading-relaxed">
          Create games and seasons before scheduling matches or registering teams. Every match and team registration depends on at least one game and one active season.
        </p>
      </div>

      {dbError && <DbErrorNotice variant="not-configured" />}

      {!dbError && <LeagueSetupClient games={games} seasons={seasons} />}
    </div>
  );
}
