import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { asc, desc } from 'drizzle-orm';
import ContentEditor from './ContentEditor';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';

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
    <div className="space-y-8">
      {!dbConfigured && <DbErrorNotice variant="not-configured" />}

      <Card className="bg-surface-raised/30 border border-line border-l-4 border-l-accent">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">Page Content Blocks</h2>
            <p className="text-xs text-foreground-muted mt-1">These blocks are managed by the system. Contact a developer to add or remove content keys.</p>
          </div>
          {dbConfigured && (
            <span className="text-foreground-secondary text-sm">{rows.length} block{rows.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-foreground-muted text-sm">
            {dbConfigured
              ? 'No content blocks yet. Run the Phase 2 seed to populate defaults.'
              : 'Connect the database to manage content.'}
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="space-y-1">
                <p className="text-xs text-foreground-muted font-mono">
                  <span className="text-foreground-muted">Appears on:</span> {keyPageMap[row.key] ?? row.key}
                </p>
                <ContentEditor
                  id={row.id}
                  label={row.label}
                  contentKey={row.key}
                  initialContent={row.content}
                  history={historyRows.filter((h) => h.contentKey === row.key)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
