'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getURLFromRedirectError,
  isRedirectError,
} from 'next/dist/client/components/redirect';
import { initLogin } from './actions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const params = Object.fromEntries(searchParams.entries());
        await initLogin(params);
      } catch (e) {
        if (cancelled) return;
        if (isRedirectError(e)) {
          const url = getURLFromRedirectError(e);
          if (url) window.location.assign(url);
          return;
        }
        setError(e instanceof Error ? e.message : 'Failed to start login');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-destructive">{error}</p>
        <a
          href="/error?reason=login_failed"
          className="text-xs font-var(--font-space-grotesk) text-foreground hover:underline"
        >
          Go to error page
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <LoadingSpinner tone="foreground" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <LoadingSpinner tone="foreground" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
