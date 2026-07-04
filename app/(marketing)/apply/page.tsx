import type { Metadata } from 'next';
import ApplyForm from './ApplyForm';

export const metadata: Metadata = {
  title: 'Apply to Join | EZ Esports',
  description:
    'Bring EZ Esports to your NYC high school. Apply to join the league and give your students competitive esports opportunities in Valorant, League of Legends, and TFT.',
};

export default function ApplyPage() {
  return <ApplyForm />;
}
