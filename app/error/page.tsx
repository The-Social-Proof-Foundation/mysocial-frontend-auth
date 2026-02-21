'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function ErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? 'unknown';
  const message = searchParams.get('message');
  const provider = searchParams.get('provider');

  const messages: Record<string, string> = {
    invalid_params: message ?? 'Invalid or missing parameters',
    provider_not_configured: `Provider "${provider ?? 'unknown'}" is not configured`,
    login_failed: 'Failed to start sign in',
    callback_failed: 'Failed to complete sign in',
    session_expired: 'Session expired. Please try again.',
    unknown: 'An error occurred',
  };

  const displayMessage = messages[reason] ?? messages.unknown;
  const isInvalidParams = reason === 'invalid_params';
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-4">
      <h1 className="font-chakra-petch text-xl font-semibold">Sign In Error</h1>
      <p className="text-center text-muted-foreground max-w-md">
        {displayMessage}
      </p>
      {isInvalidParams && (
        <p className="text-center text-sm text-muted-foreground max-w-md">
          The login URL must include all required OAuth parameters (client_id, redirect_uri, state, nonce, return_origin, mode, provider, code_challenge, code_challenge_method). See README for the URL contract.
        </p>
      )}
      {isInvalidParams && isDev && (
        <p className="text-center text-xs text-muted-foreground max-w-md">
          For local testing without a client app, set NEXT_PUBLIC_DEV_CLIENT_ID and NEXT_PUBLIC_DEV_CODE_CHALLENGE in .env.
        </p>
      )}
      <Button variant="outline" asChild>
        <Link href="/">Return home</Link>
      </Button>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
