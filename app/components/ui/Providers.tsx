'use client';

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

  return (
    <RouterProvider navigate={(href, opts) => router.push(href, opts as NextNavigateOptions)}>
      {children}
    </RouterProvider>
  );
}
