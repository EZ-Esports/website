'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Dialog,
  Heading,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components';
import { HiOutlineAcademicCap, HiOutlineChevronDown } from 'react-icons/hi2';
import { completePortalTour } from '@/app/lib/onboarding/tour-actions';
import {
  TOUR_SECTIONS,
  resolveTourSteps,
  tourAnchorSelector,
  type ResolvedTourStep,
  type TourSelection,
} from './steps';

interface PortalTourProps {
  /** True once this account has ended the tour; false triggers the first-run auto-start. */
  tourCompleted: boolean;
  /** Auth user id; scopes the remount guard so a different login in the same tab still gets its tour. */
  accountId: string;
}

interface TourSession {
  steps: ResolvedTourStep[];
  index: number;
  /** Only the automatic first-run tour records dismissal; replays never touch the flag. */
  isFirstRun: boolean;
}

// Module scope so it survives a remount of the component (the server prop only
// catches up after revalidation).
let firstRunEndedFor: string | null = null;

const SPOTLIGHT_PADDING = 6;
const FALLBACK_HEADER_HEIGHT = 72;

const quietButton =
  'min-h-[44px] px-3 text-sm font-medium text-foreground-muted hover:text-foreground rounded-lg outline-none cursor-pointer data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent';
const secondaryButton =
  'min-h-[44px] px-4 text-sm font-semibold text-foreground border border-line rounded-lg outline-none cursor-pointer hover:bg-surface data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent aria-disabled:opacity-40 aria-disabled:cursor-default';
const primaryButton =
  'min-h-[44px] px-5 text-sm font-bold bg-accent text-on-accent rounded-lg outline-none cursor-pointer hover:opacity-90 data-[focus-visible]:ring-2 data-[focus-visible]:ring-offset-2 data-[focus-visible]:ring-accent data-[focus-visible]:ring-offset-surface-raised';
const menuItemClass =
  'flex items-center min-h-[44px] px-3.5 text-sm font-semibold text-foreground rounded-lg outline-none cursor-pointer data-[focused]:bg-surface data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent';

function findTarget(step: ResolvedTourStep): HTMLElement | null {
  return document.querySelector<HTMLElement>(tourAnchorSelector(step.anchor));
}

/** Brings the target clear of the sticky portal header and the viewport bottom. */
function scrollTargetIntoView(target: HTMLElement) {
  const header = document.querySelector('header');
  const headerHeight =
    header?.getBoundingClientRect().height ?? FALLBACK_HEADER_HEIGHT;
  const top = headerHeight + 16;
  const bottom = window.innerHeight - 16;
  const rect = target.getBoundingClientRect();
  if (rect.top >= top && rect.bottom <= bottom) return;

  // Instant on purpose: the popover positions against the settled rect, and it keeps
  // the no-travel-animation promise for prefers-reduced-motion without a branch.
  const fitsInView = rect.height <= bottom - top;
  const delta = fitsInView
    ? rect.top - (top + (bottom - top - rect.height) / 2)
    : rect.top - top;
  window.scrollBy({ top: delta, behavior: 'auto' });
}

export default function PortalTour({ tourCompleted, accountId }: PortalTourProps) {
  const [session, setSession] = useState<TourSession | null>(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [targetReady, setTargetReady] = useState(false);
  // Local mirror of the server flag: the prop only updates after revalidation, so a
  // remount in between must not restart a tour the manager just ended.
  const [completed, setCompleted] = useState(tourCompleted || firstRunEndedFor === accountId);

  const tutorialButtonRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const autoStarted = useRef(false);

  const step = session ? session.steps[session.index] : null;

  const start = useCallback((selection: TourSelection, isFirstRun: boolean) => {
    const steps = resolveTourSteps(selection, (anchor) =>
      Boolean(document.querySelector(tourAnchorSelector(anchor))),
    );
    if (steps.length === 0) return;
    setConfirmingSkip(false);
    setSession({ steps, index: 0, isFirstRun });
  }, []);

  const end = useCallback(() => {
    if (session?.isFirstRun) {
      firstRunEndedFor = accountId;
      setCompleted(true);
      // Written only when the tour ends so an abandoned first run comes back. A
      // failed write just means the tour may show once more, never a broken portal.
      completePortalTour().catch(() => {});
    }
    setSession(null);
    setConfirmingSkip(false);
    setTargetReady(false);
    targetRef.current = null;
    // Deferred past the popover's own focus-restore on unmount, which would otherwise win.
    setTimeout(() => tutorialButtonRef.current?.focus(), 50);
  }, [session, accountId]);

  // First visit: start the full tour once the page and its anchors have mounted.
  useEffect(() => {
    if (completed || firstRunEndedFor === accountId || autoStarted.current) return;
    autoStarted.current = true;
    start('full', true);
  }, [completed, accountId, start]);

  // Resolve the current target. A step whose anchor has vanished is skipped, so a
  // missing element can never strand the manager on a dead step.
  useLayoutEffect(() => {
    if (!session || !step) return;
    const target = findTarget(step);
    if (!target) {
      setTargetReady(false);
      if (session.index < session.steps.length - 1) {
        setSession({ ...session, index: session.index + 1 });
      } else {
        end();
      }
      return;
    }
    scrollTargetIntoView(target);
    targetRef.current = target;
    setRect(target.getBoundingClientRect());
    setTargetReady(true);
    // Re-run only on navigation; `session` is a fresh object on every transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.index, session?.steps]);

  // Keep the spotlight on the target through resize and scroll.
  useEffect(() => {
    if (!session || !targetReady) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (targetRef.current)
          setRect(targetRef.current.getBoundingClientRect());
      });
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [session, targetReady]);

  const goTo = (delta: number) => {
    if (!session) return;
    const next = session.index + delta;
    if (next < 0) return;
    if (next >= session.steps.length) {
      end();
      return;
    }
    setSession({ ...session, index: next });
  };

  // Document-level so arrows and Esc keep working if the manager clicks into the page.
  // Latest handler is read through a ref to avoid re-subscribing on every step.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setConfirmingSkip((c) => !c);
      return;
    }
    if (confirmingSkip) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(-1);
    }
  };
  const tourActive = session !== null;
  useEffect(() => {
    if (!tourActive) return;
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tourActive]);

  const isLast = session ? session.index === session.steps.length - 1 : false;
  const isOpen = Boolean(session && step && targetReady);

  return (
    <>
      <MenuTrigger>
        <Button
          ref={tutorialButtonRef}
          data-tour="tutorial-button"
          className="min-h-[44px] inline-flex items-center gap-2 px-3.5 text-sm font-semibold text-foreground bg-surface border border-line rounded-xl outline-none cursor-pointer hover:bg-surface-raised data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent"
        >
          <HiOutlineAcademicCap
            className="w-4 h-4 text-accent"
            aria-hidden="true"
          />
          <span>Tutorial</span>
          <HiOutlineChevronDown
            className="w-3.5 h-3.5 text-foreground-muted"
            aria-hidden="true"
          />
        </Button>
        <Popover
          placement="bottom end"
          offset={8}
          className="w-56 bg-surface-raised border border-line rounded-xl shadow-2xl p-1 outline-none"
        >
          <Menu
            aria-label="Portal tutorial"
            className="outline-none py-1"
            onAction={(key) => start(String(key), false)}
          >
            <MenuItem id="full" className={menuItemClass}>
              Full tour
            </MenuItem>
            {TOUR_SECTIONS.map((section) => (
              <MenuItem
                key={section.id}
                id={section.id}
                className={menuItemClass}
              >
                {section.label}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>

      {isOpen && rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[55] rounded-xl ring-2 ring-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      )}

      {session && step && (
        <Popover
          key={`${step.id}:${confirmingSkip ? 'confirm' : 'step'}`}
          triggerRef={targetRef}
          isOpen={isOpen}
          // Non-modal: a modal popover locks page scroll, which stops the tour from scrolling
          // targets into view. The popover is absolutely positioned, so it scrolls with its target.
          // Esc is handled by the document listener above, never by popover dismissal.
          isNonModal
          onOpenChange={() => {}}
          placement="bottom"
          offset={SPOTLIGHT_PADDING + 10}
          containerPadding={12}
          className="z-[60] w-[min(24rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-surface-raised text-foreground border border-line rounded-2xl shadow-2xl outline-none"
        >
          <Dialog
            aria-label={confirmingSkip ? 'Skip the tour?' : step.title}
            className="p-5 outline-none"
          >
            <div>
              {confirmingSkip ? (
                <div className="space-y-4">
                  <Heading slot="title" className="text-base font-bold">
                    Skip the tour?
                  </Heading>
                  <p className="text-sm text-foreground-secondary">
                    You can replay it any time from the Tutorial button at the
                    top of the page.
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button className={quietButton} onPress={end}>
                      Skip tour
                    </Button>
                    <Button
                      autoFocus
                      className={primaryButton}
                      onPress={() => setConfirmingSkip(false)}
                    >
                      Keep going
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
                      {step.sectionLabel}
                      <span className="text-foreground-muted">
                        {' '}
                        &middot; Step {session.index + 1} of{' '}
                        {session.steps.length}
                      </span>
                    </p>
                    <Heading slot="title" className="mt-1 text-lg font-bold">
                      {step.title}
                    </Heading>
                    <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                      {step.body}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      className={quietButton}
                      onPress={() => setConfirmingSkip(true)}
                    >
                      Skip
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        aria-disabled={session.index === 0}
                        className={secondaryButton}
                        onPress={() => goTo(-1)}
                      >
                        Back
                      </Button>
                      <Button
                        autoFocus
                        className={primaryButton}
                        onPress={() => goTo(1)}
                      >
                        {isLast ? 'Finish' : 'Next'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Dialog>
        </Popover>
      )}
    </>
  );
}
