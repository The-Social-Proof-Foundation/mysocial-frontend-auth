'use client';

import { BackgroundCells } from '@/components/ui/background-ripple-effect';
import { SparklesCore } from '@/components/ui/sparkles';
import { LoginWalletModal } from '@/components/LoginWalletModal';

function FilledLockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3H9z" />
    </svg>
  );
}

export default function HomePage() {
  const network = process.env.NEXT_PUBLIC_MYSOCIAL_NETWORK?.trim().toLowerCase();
  const verifiedHost =
    network === 'mainnet' ? 'do.my-social.network' : 'auth.testnet.mysocial.network';

  return (
    <div className="relative min-h-screen w-screen max-w-[100vw] overflow-x-hidden bg-background pt-0">
      <div
        className="absolute top-0 left-0 right-0 w-full h-[60vh] overflow-hidden z-0"
        style={{
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          width: '100vw',
          overflowX: 'hidden',
        }}
      >
        <BackgroundCells className="w-full h-full" />
      </div>

      <div
        className="absolute inset-0 w-full h-[75vh] -translate-y-[100px] z-[1]"
        style={{
          pointerEvents: 'none',
          maskImage:
            'radial-gradient(ellipse 80% 100% at center top, white 10%, white 30%, transparent 70%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 100% at center top, white 10%, white 30%, transparent 70%)',
        }}
      >
        <SparklesCore
          background="transparent"
          minSize={0.35}
          maxSize={0.9}
          particleDensity={35}
          className="w-full h-full pt-12"
          particleColor={['#ffffff', '#f0f9ff', '#ecfdf5', '#22c55e', '#10b981', '#059669']}
          speed={2}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-start pt-10 pb-[calc(3.5rem+env(safe-area-inset-bottom))] w-full pointer-events-none">
        <LoginWalletModal />
      </div>

      <footer
        className="fixed bottom-0 left-0 right-0 z-[100] border-t border-white/10 bg-[#070b12]/95 backdrop-blur-sm pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-1.5 sm:px-4">
          <span className="text-[11px] sm:text-xs font-space-grotesk text-muted-foreground">
            always ensure you are on:
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-800/60 bg-green-950/90 px-2 py-0.5 text-[11px] sm:text-xs font-space-grotesk font-medium text-green-100/95 tabular-nums">
            <FilledLockIcon className="size-3 shrink-0 text-emerald-300" />
            {verifiedHost}
          </span>
        </div>
      </footer>
    </div>
  );
}
