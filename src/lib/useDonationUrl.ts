'use client';

import { useState, useEffect } from 'react';
import { BUY_ME_A_COFFEE_URL } from '@/lib/constants/donations';

let cachedUrl: string | null = null;

export function useDonationUrl(): string {
  const [url, setUrl] = useState<string>(cachedUrl || BUY_ME_A_COFFEE_URL);

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveUrl() {
      try {
        const res = await fetch('/api/config/donations', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.url && isMounted) {
            cachedUrl = data.url;
            setUrl(data.url);
          }
        }
      } catch {}
    }

    fetchLiveUrl();

    return () => {
      isMounted = false;
    };
  }, []);

  return url;
}
