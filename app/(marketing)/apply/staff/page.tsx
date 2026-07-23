import type { Metadata } from 'next';
import StaffApplyForm from './StaffApplyForm';

export const metadata: Metadata = {
  title: 'Staff Application | EZ Esports',
  description:
    'Join the EZ Esports team. Apply to become a league staff member and help build the future of high school esports in NYC.',
};

export default function StaffApplyPage() {
  return <StaffApplyForm />;
}
