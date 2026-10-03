import Link from 'next/link';
import { HiArrowRight } from 'react-icons/hi2';
import type { AdminNavCategory } from '@/app/lib/admin-nav';

interface AdminControlPanelProps {
  /** Already filtered to the viewer's permissions (`filterAdminNav`). */
  categories: AdminNavCategory[];
}

/**
 * The Overview hub, laid out like the Windows Control Panel "Category" view:
 * one panel per category with an icon and title and links to the sections
 * it holds. Takes the same filtered tree as the
 * sidebar, so a viewer only ever sees links they are allowed to open.
 *
 * Must stay a server component: categories carry `IconType` functions, which
 * cannot cross into a client component as props.
 */
export default function AdminControlPanel({ categories }: AdminControlPanelProps) {
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="control-panel-heading" className="space-y-4">
      <div>
        <h2 id="control-panel-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          Control Panel
        </h2>
        <p className="mt-0.5 pl-3.5 text-sm text-foreground-secondary">Jump to any section.</p>
      </div>

      {/* Three columns on wide screens so every category sits side by side
          instead of stacking below the fold. Panels cascade in on load. */}
      <div className="admin-stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <CategoryPanel key={category.id} category={category} />
        ))}
      </div>
    </section>
  );
}

function CategoryPanel({ category }: { category: AdminNavCategory }) {
  const Icon = category.icon;
  const headingId = `control-panel-${category.id}`;

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 rounded-2xl bg-admin-panel p-5 ring-1 ring-transparent transition-shadow duration-200 hover:ring-accent/25">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 id={headingId} className="text-sm font-semibold text-foreground">
            {category.label}
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-foreground-secondary">{category.description}</p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-foreground-secondary">Quick links</h4>
        {/* Accent text links with an always-visible arrow so they read as
            links at a glance; each section's description is a hover tooltip. */}
        <ul className="mt-1.5 space-y-0.5">
          {category.items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                title={item.description}
                className="group inline-flex min-h-7 items-center gap-1.5 rounded text-sm font-medium text-accent hover:underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <HiArrowRight
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-accent/60 transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:text-accent motion-reduce:transition-none"
                />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
