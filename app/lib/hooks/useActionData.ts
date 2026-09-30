'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Load data from a server action inside a client component.
 *
 * Results are keyed to (key, refresh-version): while the current key hasn't
 * resolved yet `data` is null, which doubles as the loading flag — no
 * synchronous setState-in-effect resets needed. `refresh()` refetches the
 * current key (call it after a mutation). On fetch failure `data` settles to
 * `fallback` so consumers don't spin forever, AND `fetchError` is set to true
 * so the UI can distinguish "empty data" from "fetch failed" and show an error
 * banner instead of an editable empty-state table.
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
  const [loaded, setLoaded] = useState<{ baseKey: string; key: string; data: T; error: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current()
      .then((data) => !cancelled && setLoaded({ baseKey: key, key: dataKey, data, error: false }))
      .catch(() => !cancelled && setLoaded((prev) => ({
        baseKey: key,
        key: dataKey,
        data: prev?.baseKey === key ? prev.data : fallbackRef.current,
        error: true,
      })));
    return () => {
      cancelled = true;
    };
  }, [key, dataKey]);

  const sameBase = loaded?.baseKey === key;
  const current = loaded?.key === dataKey ? loaded : null;

  return {
    data: current ? current.data : (sameBase ? loaded.data : null),
    /** True when the most recent fetch failed. Use to show an error banner
     *  instead of treating an empty fallback as real empty data. */
    fetchError: current ? current.error : (sameBase ? loaded.error : false),
    refresh: () => setVersion((v) => v + 1),
  };
}
