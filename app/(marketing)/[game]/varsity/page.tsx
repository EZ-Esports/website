import type { Metadata } from 'next';
import GameHubView, { generateGameHubMetadata } from '../GameHubView';

interface PageProps {
  params: Promise<{ game: string }>;
}

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return generateGameHubMetadata(params, 'Varsity');
}

export default function VarsityHubPage({ params }: PageProps) {
  return <GameHubView params={params} division="Varsity" />;
}
