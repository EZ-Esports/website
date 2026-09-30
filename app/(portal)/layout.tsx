import { redirect } from 'next/navigation';
import { getSchoolManagerContext } from '@/app/lib/onboarding/manager-auth';
import PortalShell from './PortalShell';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export default async function PortalLayout({ children }: PortalLayoutProps) {
  const context = await getSchoolManagerContext();

  if (!context) {
    redirect('/login');
  }

  return <PortalShell context={context}>{children}</PortalShell>;
}
