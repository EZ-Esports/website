'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Load data from a server action inside a client component.
 *
 * Results are keyed to (key, refresh-version): while the current key hasn't
 * resolved yet `data` is null, which doubles as the loading flag — no
 * synchronous setState-in-effect resets needed. `refresh()` refetches the
 * current key (call it after a mutation). On fetch failure `data` settles to
 * `fallback` so consumers don't spin forever.
 */
export function useActionData<T>(fetcher: () => Promise<T>, key: string, fallback: T) {
  // The fetcher closure changes identity every render; refs keep the fetch
  // effect keyed on `key`/`version` only. Refs are written in an effect (not
  // during render); it is declared first, so it runs before the fetch effect.
  const fetcherRef = useRef(fetcher);
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fetcherRef.current = fetcher;
    fallbackRef.current = fallback;
  });

  const [version, setVersion] = useState(0);
  const dataKey = `${key}:${version}`;
  const [loaded, setLoaded] = useState<{ key: string; data: T } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current()
      .then((data) => !cancelled && setLoaded({ key: dataKey, data }))
      .catch(() => !cancelled && setLoaded({ key: dataKey, data: fallbackRef.current }));
    return () => {
      cancelled = true;
    };
  }, [dataKey]);

  return {
    data: loaded?.key === dataKey ? loaded.data : null,
    refresh: () => setVersion((v) => v + 1),
  };
}
