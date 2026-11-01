'use client';

import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components';
import { HiOutlineQuestionMarkCircle } from 'react-icons/hi2';
import { TRACKER_LINK_STEPS } from '@/app/lib/match-results/tracker-link-help';

/**
 * A click-to-open help popover (not a hover tooltip, so it works on touch and with a keyboard)
 * that walks a manager through getting a tracker.gg match link.
 */
export function TrackerLinkHelp() {
  return (
    <DialogTrigger>
      <Button className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-sky-300 outline-none cursor-pointer hover:text-sky-200 sm:min-h-0 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400">
        <HiOutlineQuestionMarkCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>How do I get a match link?</span>
      </Button>
      <Popover
        placement="bottom start"
        offset={6}
        className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl outline-none"
      >
        <Dialog aria-label="How to get a tracker.gg match link" className="space-y-3 outline-none">
          <p className="text-sm font-bold text-white">Getting a tracker.gg match link</p>
          <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-zinc-300 marker:font-semibold marker:text-zinc-500">
            {TRACKER_LINK_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            The link ends in a long match ID, like tracker.gg/valorant/match/&hellip;. Paste one link per
            game.
          </p>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
