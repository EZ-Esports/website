'use client';

import { Button, Label, ListBox, ListBoxItem, Popover, Select } from 'react-aria-components';
import { FiCheck } from 'react-icons/fi';
import { HiOutlineComputerDesktop, HiOutlineMoon, HiOutlineSun } from 'react-icons/hi2';
import { THEME_PREFERENCES, type ThemePreference } from '@/app/lib/theme';
import { useTheme } from './ThemeProvider';

const OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

/**
 * Header control for the public theme. The popover is portaled to `body`,
 * outside the header's dark token scope, so it carries `theme-dark` itself
 * and stays on the same surface as the bar it opens from.
 */
export default function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const Icon = resolved === 'light' ? HiOutlineSun : HiOutlineMoon;

  return (
    <Select
      selectedKey={preference}
      onSelectionChange={(key) => {
        if (key == null) return;
        const next = String(key);
        if ((THEME_PREFERENCES as readonly string[]).includes(next)) {
          setPreference(next as ThemePreference);
        }
      }}
    >
      <Label className="sr-only">Color theme</Label>
      <Button className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line bg-surface-raised/40 text-foreground/90 hover:text-accent hover:bg-surface-raised cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/50 transition-colors">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </Button>
      <Popover
        placement="bottom end"
        offset={8}
        className="theme-dark w-44 rounded-xl border border-line bg-surface-raised p-1.5 shadow-2xl outline-none"
      >
        <ListBox className="outline-none">
          {OPTIONS.map((option) => (
            <ListBoxItem
              key={option.id}
              id={option.id}
              textValue={option.label}
              className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-sm font-semibold text-foreground-secondary outline-none data-[focused]:bg-accent/10 data-[focused]:text-foreground data-[selected]:text-foreground"
            >
              {({ isSelected }) => (
                <>
                  <span className="flex items-center gap-2">
                    {option.id === 'light' && <HiOutlineSun className="h-4 w-4" aria-hidden="true" />}
                    {option.id === 'dark' && <HiOutlineMoon className="h-4 w-4" aria-hidden="true" />}
                    {option.id === 'system' && <HiOutlineComputerDesktop className="h-4 w-4" aria-hidden="true" />}
                    {option.label}
                  </span>
                  {isSelected && <FiCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
