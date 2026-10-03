'use client';

import type { ReactNode } from 'react';
import {
  RadioButton,
  RadioField,
  RadioGroup,
  SelectionIndicator,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type Key,
  type TabPanelProps,
  type TabsProps,
} from 'react-aria-components';
import { cx } from '@/app/lib/cx';
import { segmentedGroup } from '@/app/components/admin/styles';

/*
 * In-page tabs and segmented choices for the staff portal (spec-013), built on
 * RAC so keyboard support (arrow keys, Home/End) and roles come for free.
 * The selection marker is a RAC `SelectionIndicator`: when the selection
 * moves, RAC measures the old and new position and the indicator glides
 * across via a `translate`/`width` transition (instantly with reduced
 * motion). Use plain Links (`AdminFilterTabs`) for filters that live in the URL.
 */

const indicatorMotion = 'transition-[translate,width] duration-250 ease-out motion-reduce:transition-none';

export function AdminTabs({ className, ...props }: Omit<TabsProps, 'className'> & { className?: string }) {
  return <Tabs {...props} className={cx('space-y-5', className)} />;
}

type TabVariant = 'underline' | 'pill';

export function AdminTabList({
  'aria-label': ariaLabel,
  variant = 'underline',
  children,
}: {
  'aria-label': string;
  variant?: TabVariant;
  children: ReactNode;
}) {
  return (
    <TabList
      aria-label={ariaLabel}
      className={variant === 'underline' ? 'flex items-center gap-6 border-b border-line/60' : segmentedGroup}
    >
      {children}
    </TabList>
  );
}

export function AdminTab({ id, variant = 'underline', children }: { id: Key; variant?: TabVariant; children: ReactNode }) {
  return (
    <Tab
      id={id}
      className={({ isSelected, isFocusVisible }) =>
        cx(
          'relative inline-flex items-center gap-2 font-medium whitespace-nowrap cursor-pointer outline-none transition-colors duration-200',
          variant === 'underline' ? 'h-11 text-sm' : 'z-0 h-7 rounded-md px-3 text-xs',
          isSelected ? (variant === 'pill' ? 'text-accent' : 'text-foreground') : 'text-foreground-secondary hover:text-foreground',
          isFocusVisible && 'rounded-md ring-2 ring-accent/60',
        )
      }
    >
      {children}
      <SelectionIndicator
        className={cx(
          'absolute left-0 w-full',
          variant === 'underline'
            ? '-bottom-px h-0.5 rounded-full bg-accent'
            : 'top-0 -z-10 h-full rounded-md bg-accent/20',
          indicatorMotion,
        )}
      />
    </Tab>
  );
}

export function AdminTabPanel({ className, ...props }: Omit<TabPanelProps, 'className'> & { className?: string }) {
  return <TabPanel {...props} className={cx('admin-fade-in outline-none', className)} />;
}

interface AdminSegmentedProps<T extends string> {
  'aria-label': string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  className?: string;
}

/**
 * A two-to-four way mode switch ("Assign existing" / "New person") as a RAC
 * RadioGroup, with the same gliding pill as the pill tabs. Render it outside
 * any `<form>`: RAC radios carry a generated `name`, which would otherwise be
 * submitted with the form.
 */
export function AdminSegmented<T extends string>({ 'aria-label': ariaLabel, value, onChange, options, className }: AdminSegmentedProps<T>) {
  return (
    <RadioGroup
      aria-label={ariaLabel}
      orientation="horizontal"
      value={value}
      onChange={(v) => onChange(v as T)}
      className={cx(segmentedGroup, className)}
    >
      {/* RadioField (not Radio): in RAC 1.19 only RadioField provides the
          SelectionIndicator context, so the indicator sits beside the button. */}
      {options.map((option) => (
        <RadioField key={option.value} value={option.value} className="relative z-0 flex">
          <RadioButton
            className={({ isSelected, isFocusVisible }) =>
              cx(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap cursor-pointer outline-none transition-colors duration-200',
                isSelected ? 'text-accent' : 'text-foreground-secondary hover:text-foreground',
                isFocusVisible && 'ring-2 ring-accent/60',
              )
            }
          >
            {option.icon}
            {option.label}
          </RadioButton>
          <SelectionIndicator
            className={cx('pointer-events-none absolute left-0 top-0 -z-10 h-full w-full rounded-md bg-accent/20', indicatorMotion)}
          />
        </RadioField>
      ))}
    </RadioGroup>
  );
}
