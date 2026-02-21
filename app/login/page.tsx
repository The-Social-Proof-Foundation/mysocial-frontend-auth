'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { initLogin } from './actions';
import { LoadingSpinner } from '@/components/LoadingSpinner';

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await initLogin(searchParams);
        if (cancelled) return;
        if (result?.providerUrl) {
          window.location.href = result.providerUrl;
        }
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'digest' in e) {
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
          className="text-sm text-foreground hover:underline"
        >
          Go to error page
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <LoadingSpinner className="text-foreground" />
      <p className="text-sm text-muted-foreground">
        Redirecting to sign in...
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <LoadingSpinner className="text-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading...
          </p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
