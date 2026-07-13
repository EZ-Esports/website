import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes, HTMLAttributes } from 'react';
import { cx } from '@/app/lib/cx';

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
  className?: string;
}

/** overflow-x-auto shell + <table> element. Compose with native <thead>/<tbody> and the Th/Tr/Td cell primitives below. */
export function Table({ children, className = '', ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full border-collapse', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

const alignStyles = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Th({ align = 'left', className = '', ...props }: ThProps) {
  return (
    <th
      className={cx('px-6 py-4 text-xs font-bold text-foreground-muted uppercase tracking-widest', alignStyles[align], className)}
      {...props}
    />
  );
}

type TdProps = TdHTMLAttributes<HTMLTableCellElement>;

export function Td({ className = '', ...props }: TdProps) {
  return <td className={cx('px-6 py-4 text-sm text-foreground-secondary', className)} {...props} />;
}

interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
}

export function Tr({ interactive = false, className = '', ...props }: TrProps) {
  return (
    <tr
      className={cx(interactive && 'hover:bg-surface-sunken/40 transition-colors', className)}
      {...props}
    />
  );
}
