import { cx } from '@/app/lib/cx';

interface GradientRuleProps {
  /** Horizontally centers the rule (e.g. below a centered section heading). Defaults to true. */
  center?: boolean;
  className?: string;
}

export default function GradientRule({ center = true, className = '' }: GradientRuleProps) {
  return (
    <div
      className={cx('w-12 h-0.5 bg-gradient-to-r from-accent to-accent-secondary', center && 'mx-auto', className)}
      aria-hidden="true"
    />
  );
}
