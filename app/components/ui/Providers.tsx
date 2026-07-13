'use client';

import { useRouter } from 'next/navigation';
import { RouterProvider } from 'react-aria-components';

// Wires RAC's internal navigation (Link, Menu item hrefs, etc.) to the Next.js
// App Router so client-side transitions go through router.push instead of a
// full page load. See https://react-spectrum.adobe.com/react-aria/routing.html
export default function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <RouterProvider navigate={(href, opts) => router.push(href, opts)}>
      {children}
    </RouterProvider>
  );
}
