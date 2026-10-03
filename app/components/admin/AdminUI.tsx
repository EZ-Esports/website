import Link from 'next/link';
import type { InputHTMLAttributes, ReactNode } from 'react';
import {
  HiCheckCircle,
  HiExclamationCircle,
  HiExclamationTriangle,
  HiInformationCircle,
  HiArrowLeft,
  HiMagnifyingGlass,
  HiXMark,
} from 'react-icons/hi2';
import { cx } from '@/app/lib/cx';
import { getAdminBreadcrumb } from '@/app/lib/admin-nav';
import {
  focusRing,
  helpText,
  iconBtnSm,
  input as inputClass,
  inputSm as inputSmClass,
  label as labelClass,
  segmentedGroup,
  segmentedItem,
} from '@/app/components/admin/styles';

/*
 * Staff portal layout primitives (spec-013). Every admin page has the same
 * anatomy:
 *
 *   <AdminPage>
 *     <AdminPageHeader title description actions />   one h1, primary action on the right
 *     <AdminSection title …>…</AdminSection>          as many as the page needs
 *   </AdminPage>
 *
 * and the same empty, loading, notice and error states. Deliberately free of
 * hooks and 'use client', so server pages and client managers can both use
 * them. Callbacks (onDismiss) are only ever passed from client components.
 */

/* ---------------------------------------------------------------------------
 * Page anatomy
 * ------------------------------------------------------------------------- */

/** Page wrapper: section rhythm plus the one-off fade/rise on route entry. */
export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('admin-page-enter space-y-6', className)}>{children}</div>;
}

interface AdminPageHeaderProps {
  /**
   * The page's route. Its sidebar category becomes the eyebrow and its nav
   * label the title (via `getAdminBreadcrumb`), so the header always matches
   * the sidebar and breadcrumb wording. `title` / `eyebrow` override.
   */
  route?: string;
  title?: ReactNode;
  /** One line: what this page is for. */
  description?: ReactNode;
  /** The page's primary action (and at most one or two secondary ones), right-aligned. */
  actions?: ReactNode;
  /** Parent page link for nested pages such as an article editor. */
  back?: { href: string; label: string };
  /** Small facts under the description (counts, status chip). */
  meta?: ReactNode;
  /** Accent overline above the title, normally the page's sidebar category. */
  eyebrow?: ReactNode;
}

/*
 * Accent (brand pink) rules for the staff portal, spec-013:
 * pink marks emphasis and state, never large fills. One or two touches per
 * region: the page eyebrow and title rule, section title dots, primary
 * buttons, the active tab/filter, focus rings, links, empty-state icon tiles,
 * and hover edges on clickable cards. Dark surfaces only (the token is light pink).
 */
export function AdminPageHeader({ route, title: titleProp, description, actions, back, meta, eyebrow: eyebrowProp }: AdminPageHeaderProps) {
  const crumb = route ? getAdminBreadcrumb(route) : null;
  const title = titleProp ?? crumb?.title;
  const eyebrow = eyebrowProp ?? crumb?.category;
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-2">
      <div className="min-w-0 max-w-3xl">
        {back && (
          <Link
            href={back.href}
            className={cx(
              'group mb-2 inline-flex items-center gap-1.5 rounded text-xs font-medium text-foreground-secondary hover:text-foreground transition-colors',
              focusRing,
            )}
          >
            <HiArrowLeft
              aria-hidden
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none"
            />
            {back.label}
          </Link>
        )}
        {eyebrow && !back && (
          <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-accent">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {/* Short accent rule under the title; it draws in from the left on page entry. */}
        <span aria-hidden className="admin-rule mt-2.5 block h-0.5 w-10 rounded-full bg-accent/80" />
        {description && <p className="mt-1.5 text-sm leading-6 text-foreground-secondary">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

interface AdminSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Section-level actions (export, add row), right of the title. */
  actions?: ReactNode;
  /** A filter/search row under the title. Pass `stickyToolbar` to pin it under the top bar. */
  toolbar?: ReactNode;
  stickyToolbar?: boolean;
  children?: ReactNode;
  /**
   * `panel` (default): one surface step up, padded. `flush`: same surface, but
   * the body runs edge to edge (tables). `bare`: no surface at all, for card
   * grids that bring their own.
   */
  variant?: 'panel' | 'flush' | 'bare';
  id?: string;
  className?: string;
  /** Heading level; sections nested inside another section use h3. */
  as?: 'h2' | 'h3';
}

export function AdminSection({
  title,
  description,
  actions,
  toolbar,
  stickyToolbar = false,
  children,
  variant = 'panel',
  id,
  className,
  as: Heading = 'h2',
}: AdminSectionProps) {
  const headingId = id ? `${id}-heading` : undefined;
  const surface = variant === 'bare' ? '' : 'rounded-2xl bg-admin-panel';
  const pad = variant === 'bare' ? '' : 'px-5';
  const hasHeader = Boolean(title || description || actions);

  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cx(surface, className)}>
      {hasHeader && (
        <div className={cx(pad, variant === 'bare' ? 'pb-4' : cx('pt-5', toolbar ? 'pb-0' : 'pb-4'))}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              {title && (
                <Heading id={headingId} className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0">{title}</span>
                </Heading>
              )}
              {description && <p className={cx('mt-0.5 text-sm text-foreground-secondary', title ? 'pl-3.5' : undefined)}>{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}
      {/* The toolbar is a direct child of the section so that, when sticky, only
          the filters pin under the top bar (the title scrolls away) and it can
          travel the full height of the section. */}
      {toolbar && (
        <div
          className={cx(
            pad,
            'pb-4',
            hasHeader ? 'pt-4' : variant === 'bare' ? '' : 'pt-5',
            stickyToolbar && 'sticky top-14 z-10 bg-admin-panel',
            stickyToolbar && !hasHeader && 'rounded-t-2xl',
          )}
        >
          {toolbar}
        </div>
      )}
      <div className={cx(variant === 'panel' && 'px-5 pb-5', variant === 'flush' && 'pb-2', !hasHeader && !toolbar && variant === 'panel' && 'pt-5')}>
        {children}
      </div>
    </section>
  );
}

/** Small count shown next to a section title, e.g. "Schools 12". */
export function AdminCount({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 text-sm font-normal tabular-nums text-foreground-secondary">{children}</span>;
}

/* ---------------------------------------------------------------------------
 * States: empty, notice, toast, skeleton, spinner
 * ------------------------------------------------------------------------- */

interface AdminEmptyStateProps {
  icon?: ReactNode;
  /** One sentence: what is (not) here. */
  title: ReactNode;
  /** Optional second line: what to do about it. */
  description?: ReactNode;
  action?: ReactNode;
  /** Tighter padding for empty states inside a small panel or table. */
  compact?: boolean;
  /** Element for the title. Full-page states (permission, error) make it the page's h1. */
  titleAs?: 'p' | 'h1' | 'h2' | 'h3';
  /** Icon tile tint: accent by default, danger/warning for error states. */
  tone?: 'accent' | 'danger' | 'warning';
  /** Announce the description (not the heading or buttons) as an alert. */
  alert?: boolean;
  className?: string;
}

const emptyTone = {
  accent: 'bg-accent/15 text-accent',
  danger: 'bg-danger/15 text-danger-on-tint',
  warning: 'bg-warning/15 text-warning',
} as const;

export function AdminEmptyState({ icon, title, description, action, compact = false, titleAs: Title = 'p', tone = 'accent', alert = false, className }: AdminEmptyStateProps) {
  return (
    <div
      className={cx(
        'admin-fade-in flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={cx('flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5', emptyTone[tone])}
        >
          {icon}
        </span>
      )}
      <div className="max-w-sm space-y-1">
        <Title className={Title === 'p' ? 'text-sm font-medium text-foreground' : 'text-lg font-semibold text-foreground'}>{title}</Title>
        {description && (
          <p role={alert ? 'alert' : undefined} className="text-sm leading-6 text-foreground-secondary">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

const noticeTone: Record<NoticeTone, { box: string; icon: string; Icon: typeof HiInformationCircle }> = {
  info: { box: 'bg-sky-400/[0.07]', icon: 'text-sky-300', Icon: HiInformationCircle },
  success: { box: 'bg-success/[0.08]', icon: 'text-success', Icon: HiCheckCircle },
  warning: { box: 'bg-warning/[0.08]', icon: 'text-warning', Icon: HiExclamationTriangle },
  danger: { box: 'bg-danger/10', icon: 'text-danger-on-tint', Icon: HiExclamationCircle },
};

interface AdminNoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  /** A link or button aligned right (e.g. "Enter scores"). */
  action?: ReactNode;
  onDismiss?: () => void;
  /**
   * Announcement semantics. Defaults to `alert` for danger and `status` for
   * the rest; pass `none` for static notices that are part of the page.
   */
  live?: 'alert' | 'status' | 'none';
  className?: string;
}

/**
 * Inline message block: form-level errors and successes, page warnings, the
 * database notice. One look for every page, tinted by tone, no border.
 */
export function AdminNotice({ tone = 'info', title, children, action, onDismiss, live, className }: AdminNoticeProps) {
  const { box, icon, Icon } = noticeTone[tone];
  const resolvedLive = live ?? (tone === 'danger' ? 'alert' : 'status');
  const role = resolvedLive === 'none' ? undefined : resolvedLive;
  return (
    <div role={role} className={cx('admin-fade-in flex items-start gap-3 rounded-xl px-4 py-3', box, className)}>
      <Icon aria-hidden className={cx('mt-0.5 h-5 w-5 shrink-0', icon)} />
      <div className="min-w-0 flex-1 text-sm leading-6">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className="text-foreground-secondary">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={cx(iconBtnSm, '-my-1 -mr-2')}>
          <HiXMark aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface AdminToastProps {
  toast: { message: string; type: 'success' | 'error' } | null;
  onDismiss?: () => void;
}

/**
 * Floating save feedback, bottom-right, for actions taken deep inside long
 * lists (a row save, a delete) where an inline banner at the top of the page
 * would be off-screen. Same state the managers already keep; only the
 * placement and look are shared.
 */
export function AdminToast({ toast, onDismiss }: AdminToastProps) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  const Icon = isError ? HiExclamationCircle : HiCheckCircle;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className="admin-toast fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl bg-surface-raised px-4 py-3 text-sm shadow-2xl shadow-black/50 ring-1 ring-line/70"
    >
      <Icon aria-hidden className={cx('mt-0.5 h-5 w-5 shrink-0', isError ? 'text-danger-on-tint' : 'text-success')} />
      <span className="min-w-0 flex-1 leading-6 text-foreground">{toast.message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={cx(iconBtnSm, '-my-1 -mr-2')}>
          <HiXMark aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Shimmering placeholder block. Size it with className. */
export function AdminSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('admin-skeleton rounded-md', className)} />;
}

/** Skeleton rows for a list or table whose layout is known. */
export function AdminSkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('divide-y divide-line/50', className)} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <AdminSkeleton className="h-8 w-8 rounded-full" />
          <AdminSkeleton className="h-3.5 w-1/4" />
          <AdminSkeleton className="h-3.5 w-1/5" />
          <AdminSkeleton className="ml-auto h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Small inline spinner for pending buttons. */
export function AdminSpinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className={cx('h-3.5 w-3.5 shrink-0 animate-spin', className)}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Button content that swaps to a spinner and a pending label while an action runs. */
export function PendingLabel({ pending, label, pendingLabel }: { pending: boolean; label: ReactNode; pendingLabel?: ReactNode }) {
  if (!pending) return <>{label}</>;
  return (
    <>
      <AdminSpinner />
      <span>{pendingLabel ?? label}</span>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Form helpers
 * ------------------------------------------------------------------------- */

/** Accent asterisk for required fields; screen readers get "required" from the input itself. */
export function RequiredMark() {
  return (
    <span aria-hidden className="ml-0.5 text-accent">
      *
    </span>
  );
}

interface AdminFieldProps {
  label: ReactNode;
  /** Associates an explicit `<label for>`. Without it the label wraps the control. */
  htmlFor?: string;
  required?: boolean;
  help?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label, control and one line of help, with the admin's field spacing. */
export function AdminField({ label, htmlFor, required, help, children, className }: AdminFieldProps) {
  const text = (
    <>
      {label}
      {required && <RequiredMark />}
    </>
  );
  if (htmlFor) {
    return (
      <div className={cx('block min-w-0', className)}>
        <label htmlFor={htmlFor} className={labelClass}>
          {text}
        </label>
        {children}
        {help && <p className={helpText}>{help}</p>}
      </div>
    );
  }
  return (
    <label className={cx('block min-w-0', className)}>
      <span className={labelClass}>{text}</span>
      {children}
      {help && <span className={cx('block', helpText)}>{help}</span>}
    </label>
  );
}

/** Divider-separated button row at the end of a form: secondary left of primary. */
export function AdminFormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-center justify-end gap-2 border-t border-line/60 pt-4', className)}>{children}</div>;
}

/* ---------------------------------------------------------------------------
 * URL-driven filter tabs
 * ------------------------------------------------------------------------- */

interface AdminFilterTabsProps {
  label: string;
  items: { key: string; label: ReactNode; href: string; active: boolean; count?: number }[];
}

/**
 * Segmented filter for filters that live in the URL (status tabs). Plain
 * Links with `aria-current`, per the `ui` skill: RAC Tabs are for in-page
 * panels. The active pill's colour change is transitioned, so the selection
 * glides rather than snaps when the page re-renders.
 */
export function AdminFilterTabs({ label, items }: AdminFilterTabsProps) {
  return (
    <nav aria-label={label} className={segmentedGroup}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          aria-current={item.active ? 'page' : undefined}
          className={segmentedItem(item.active)}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="tabular-nums text-foreground-secondary">{item.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------------------
 * Search field
 * ------------------------------------------------------------------------- */

interface AdminSearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'className'> {
  /** Accessible name; also used as the visible placeholder unless one is given. */
  'aria-label': string;
  /** `sm` (32px) for filter toolbars, `md` (36px) beside other form fields. */
  size?: 'md' | 'sm';
  /** Shows an inline clear button while the (controlled) value is non-empty. Client components only. */
  onClear?: () => void;
  /** Wrapper classes (width). */
  className?: string;
}

/**
 * Search input with a leading magnifier and an optional clear button. Works
 * controlled (value + onChange + onClear) or uncontrolled inside a GET form
 * (name + defaultValue), so server pages can use it too.
 */
export function AdminSearchField({ size = 'md', onClear, className, ...inputProps }: AdminSearchFieldProps) {
  const showClear = Boolean(onClear) && typeof inputProps.value === 'string' && inputProps.value.length > 0;
  return (
    <div className={cx('relative', className)}>
      <HiMagnifyingGlass
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted"
      />
      <input
        type="text"
        {...inputProps}
        className={cx(size === 'sm' ? inputSmClass : inputClass, 'pl-9', onClear && 'pr-9')}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className={cx(
            'absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-foreground-secondary hover:text-foreground',
            focusRing,
          )}
        >
          <HiXMark aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
