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
  /** nycstudents.net address typed in onboarding. */
  schoolEmail?: string | null;
  /** A student ID photo is on file (opened through the staff signed-URL route). */
  hasStudentId?: boolean;
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
  /**
   * Opened from a season page: new invite links are issued for this season (the manager's
   * academic year, which names the season they work on) and the choice is not offered.
   */
  seasonName?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
