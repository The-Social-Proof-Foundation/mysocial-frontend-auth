'use client';

import { BackgroundCells } from '@/components/ui/background-ripple-effect';
import { SparklesCore } from '@/components/ui/sparkles';
import { LoginWalletModal } from '@/components/LoginWalletModal';

export default function HomePage() {
  return (
    <div className="relative w-screen min-h-screen overflow-hidden max-w-[100vw] bg-background pt-0">
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

      <div className="relative z-10 flex flex-col items-center justify-start pt-10 w-full min-h-screen pointer-events-none">
        <LoginWalletModal />
      </div>
    </div>
  );
}
