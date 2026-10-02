export type { RegisteredManagerAccount } from '@/app/(admin)/admin/schools/manager-actions';

export interface GameItem {
  id: string;
  displayName: string;
  slug: string;
  name?: string;
}

export interface ManagerItem {
  id: string;
  schoolId: string;
  userId: string;
  memberId?: string | null;
  managedGames: string[] | null;
  academicYear: string;
  isPrimaryContact: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  firstName?: string | null;
  lastName?: string | null;
  email: string | null;
}

export interface ManagerInviteItem {
  id: string;
  schoolId: string;
  intendedFirstName: string;
  intendedLastName: string;
  status: string;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  submittedAt: Date | string | null;
  submissionDraft: any;
}

export interface SchoolManagersModalProps {
  school: {
    id: string;
    name: string;
    slug?: string;
  };
  games?: GameItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
