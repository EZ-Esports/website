'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select, SelectValue, Button, Popover, ListBox, ListBoxItem, Label } from 'react-aria-components';
import { FiCheck, FiChevronDown } from 'react-icons/fi';

interface SeasonOption {
  name: string;
  isActive: boolean;
}

interface SeasonSelectProps {
  /** Page the selector navigates within, e.g. "/valorant/schedule". */
  basePath: string;
  seasons: SeasonOption[];
  selected: string;
  /** Query params to preserve across season changes (division, sort, ...). */
  extraParams?: Record<string, string>;
}

/** Season dropdown that navigates via the `season` query param. */
export default function SeasonSelect({ basePath, seasons, selected, extraParams = {} }: SeasonSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (season: string) => {
    const params = new URLSearchParams(extraParams);
    params.set('season', season);
    startTransition(() => router.push(`${basePath}?${params.toString()}`));
  };

  return (
    <Select
      selectedKey={selected}
      onSelectionChange={(key) => navigate(String(key))}
      isDisabled={isPending}
      className="flex items-center gap-2"
    >
      <Label className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Season</Label>
      <Button className="px-3 py-2.5 min-h-[44px] text-sm font-bold rounded-lg bg-surface border border-line text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2">
        <SelectValue />
        <FiChevronDown className="w-3.5 h-3.5 text-foreground-muted" aria-hidden="true" />
      </Button>
      <Popover className="min-w-[var(--trigger-width)] bg-surface-sunken border border-line rounded-xl p-1.5 shadow-2xl">
        <ListBox className="outline-none">
          {seasons.map((s) => (
            <ListBoxItem
              key={s.name}
              id={s.name}
              textValue={s.name}
              className="px-3 py-2 rounded-lg text-sm font-bold text-foreground-secondary data-[focused]:bg-accent/10 data-[focused]:text-foreground cursor-pointer flex items-center justify-between gap-3 outline-none"
            >
              {({ isSelected }) => (
                <>
                  <span className="flex items-center gap-2">
                    {isSelected && <FiCheck className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />}
                    {s.name}
                  </span>
                  {s.isActive && <span className="text-[10px] font-bold uppercase text-success shrink-0">Active</span>}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
