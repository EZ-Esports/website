import { chip, chipDot, type ChipTone } from '@/app/components/admin/styles';

type NewsStatus = 'draft' | 'published' | 'archived';

const TONE: Record<NewsStatus, ChipTone> = { published: 'success', draft: 'warning', archived: 'neutral' };
const LABEL: Record<NewsStatus, string> = { published: 'Published', draft: 'Draft', archived: 'Archived' };

/** Article status as a tinted chip with a dot. Shared by the news list and the article editor header. */
export default function NewsStatusBadge({ status }: { status: NewsStatus }) {
  return (
    <span className={chip(TONE[status])}>
      <span aria-hidden className={chipDot} />
      {LABEL[status]}
    </span>
  );
}
