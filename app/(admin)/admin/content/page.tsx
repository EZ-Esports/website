import { HiOutlinePencilSquare } from 'react-icons/hi2';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { asc, desc } from 'drizzle-orm';
import ContentEditor from './ContentEditor';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminEmptyState, AdminPage, AdminPageHeader } from '@/app/components/admin/AdminUI';
import { chip } from '@/app/components/admin/styles';

const keyPageMap: Record<string, string> = {
  'hero.title': 'Homepage → Hero',
  'hero.subtitle': 'Homepage → Hero',
  'hero.cta': 'Homepage → Hero',
  home_about_blurb: 'Homepage → Our Story',
  about_mission: 'About Page → Mission',
  apply_hero: 'Apply Page → Intro',
  sponsors_intro: 'Sponsors Page → Intro',
};

async function getAllPageContent() {
  return db.select().from(schema.pageContent).orderBy(asc(schema.pageContent.key));
}

export default async function ContentAdminPage() {
  if (!(await getStaffForAdminSection('/admin/content'))) return <PermissionDenied />;

  let rows: Awaited<ReturnType<typeof getAllPageContent>> = [];
  let historyRows: { id: string; contentKey: string; previousContent: string; savedAt: Date }[] = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL) {
      rows = await getAllPageContent();
      historyRows = await db
        .select()
        .from(schema.pageContentHistory)
        .orderBy(desc(schema.pageContentHistory.savedAt));
      dbConfigured = true;
    }
  } catch {
    // db not reachable
  }

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/content"
        description="Editable text blocks across the public pages. These blocks are managed by the system. Contact a developer to add or remove content keys."
        meta={dbConfigured && <span className={chip('accent')}>{rows.length} block{rows.length !== 1 ? 's' : ''}</span>}
      />

      {!dbConfigured && <DbErrorNotice variant="not-configured" />}

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-admin-panel">
          <AdminEmptyState
            icon={<HiOutlinePencilSquare />}
            title={
              dbConfigured
                ? 'No content blocks yet. Run the Phase 2 seed to populate defaults.'
                : 'Connect the database to manage content.'
            }
          />
        </div>
      ) : (
        <div className="admin-stagger space-y-4">
          {rows.map((row) => (
            <section key={row.id} aria-labelledby={`content-heading-${row.id}`} className="rounded-2xl bg-admin-panel p-5">
              <p className="mb-3 text-xs text-foreground-secondary">
                Appears on <span className="font-medium text-accent">{keyPageMap[row.key] ?? row.key}</span>
              </p>
              <ContentEditor
                id={row.id}
                label={row.label}
                contentKey={row.key}
                initialContent={row.content}
                history={historyRows.filter((h) => h.contentKey === row.key)}
              />
            </section>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
