export type CareerPostingStatus = 'draft' | 'published' | 'closed';

export interface CareerPosting {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  commitment: string;
  employmentType: string;
  summary: string;
  description: string;
  status: CareerPostingStatus;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerPostingSummary {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  commitment: string;
  employmentType: string;
  summary: string;
  status: CareerPostingStatus;
  displayOrder: number;
  createdAt: Date;
}

export interface AdminCareerPostingWithStats extends CareerPosting {
  applicantCount: number;
  pendingCount: number;
}
