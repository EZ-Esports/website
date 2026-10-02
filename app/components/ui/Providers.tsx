'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { RouterProvider } from 'react-aria-components';

// Wires RAC's internal navigation (Link, Menu item hrefs, etc.) to the Next.js
// App Router so client-side transitions go through router.push instead of a
// full page load. See https://react-spectrum.adobe.com/react-aria/routing.html
//
// RouterOptions (from @react-types/shared) and Next.js NavigateOptions are
// structurally compatible today ({ scroll?: boolean }) but are different nominal
// types. The cast below documents this assumption — if RAC ever extends
// RouterOptions with new fields the type error will surface here first.
type NextNavigateOptions = Parameters<AppRouterInstance['push']>[1];

export default function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Suppress external Safari extension / password manager DOM reconciliation errors
    // (e.g. 1Password / AutoFill trying to run insertBefore inside webkit-masked-url).
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const stack = reason?.stack || '';
      const message = reason?.message || String(reason || '');

      if (
        stack.includes('webkit-masked-url') ||
        (message.includes('The object can not be found here') &&
          (reason?.name === 'NotFoundError' || reason?.code === 8))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleError = (event: ErrorEvent) => {
      const filename = event?.filename || '';
      const message = event?.message || '';
      const stack = event?.error?.stack || '';

      if (
        filename.includes('webkit-masked-url') ||
        stack.includes('webkit-masked-url') ||
        (message.includes('The object can not be found here') &&
          (event?.error?.name === 'NotFoundError' || event?.error?.code === 8))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <RouterProvider navigate={(href, opts) => router.push(href, opts as NextNavigateOptions)}>
      {children}
    </RouterProvider>
  );
}
