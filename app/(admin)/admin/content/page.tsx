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
  'about.mission': 'About Page → Mission',
  'about.story': 'About Page → Story',
  'apply.intro': 'Apply Page → Intro',
  'sponsors.intro': 'Sponsors Page → Intro',
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

      <Card className="bg-slate-900/30 border border-slate-800 border-l-4 border-l-ez-pink">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">Page Content Blocks</h2>
            <p className="text-xs text-slate-500 mt-1">These blocks are managed by the system. Contact a developer to add or remove content keys.</p>
          </div>
          {dbConfigured && (
            <span className="text-slate-400 text-sm">{rows.length} block{rows.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-slate-500 text-sm">
            {dbConfigured
              ? 'No content blocks yet. Run the Phase 2 seed to populate defaults.'
              : 'Connect the database to manage content.'}
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="space-y-1">
                <p className="text-xs text-slate-500 font-mono">
                  <span className="text-slate-600">Appears on:</span> {keyPageMap[row.key] ?? row.key}
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
