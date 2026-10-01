import { notFound, redirect } from 'next/navigation';
import { GAME_SLUGS, canonicalGameSlug } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';

interface GameLayoutProps {
  children: React.ReactNode;
  params: Promise<{ game: string }>;
}

export default async function GameLayout({ children, params }: GameLayoutProps) {
  const { game } = await params;
  const canonical = canonicalGameSlug(game);

  if (canonical !== game && GAME_SLUGS.includes(canonical as GameSlug)) {
    redirect(`/${canonical}`);
  }

  // Validate game slug
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  return <>{children}</>;
}



