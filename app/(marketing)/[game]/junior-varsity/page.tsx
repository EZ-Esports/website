import type { Metadata } from 'next';
import GameHubView, { generateGameHubMetadata } from '../GameHubView';

interface PageProps {
  params: Promise<{ game: string }>;
}

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return generateGameHubMetadata(params, 'JV');
}

export default function JuniorVarsityHubPage({ params }: PageProps) {
  return <GameHubView params={params} division="JV" />;
}
