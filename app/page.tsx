"use client";

import Image from "next/image";
import { BackgroundCells } from "@/components/ui/background-ripple-effect";
import { SparklesCore } from "@/components/ui/sparkles";

export default function HomePage() {
  return (
    <div className="relative w-screen min-h-screen overflow-hidden max-w-[100vw] bg-background pt-0">
      {/* BackgroundCells - constrained to ~70vh at top */}
      <div className="absolute top-0 left-0 right-0 w-full h-[60vh] overflow-hidden z-0" style={{
          marginLeft: "calc(-50vw + 50%)",
          marginRight: "calc(-50vw + 50%)",
          width: "100vw",
          overflowX: "hidden",
        }}
      >
        <BackgroundCells className="w-full h-full" />
      </div>

      {/* SparklesCore - constrained to 75vh with fade mask */}
      <div
        className="absolute inset-0 w-full h-[75vh] -translate-y-[100px] z-[1]"
        style={{
          pointerEvents: "none",
          maskImage: "radial-gradient(ellipse 80% 100% at center top, white 10%, white 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 100% at center top, white 10%, white 30%, transparent 70%)",
        }}
      >
        <SparklesCore
          background="transparent"
          minSize={0.35}
          maxSize={0.9}
          particleDensity={35}
          className="w-full h-full pt-12"
          particleColor={["#ffffff", "#f0f9ff", "#ecfdf5", "#22c55e", "#10b981", "#059669"]}
          speed={2}
        />
      </div>

      {/* Content - pointer-events-none so clicks pass through to grid; content elements get pointer-events-auto */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-16 w-full min-h-screen pointer-events-none">
        <Image
          src="/logo.svg"
          alt="MySocial"
          width={74}
          height={74}
          className="mb-4 pointer-events-auto"
          priority
        />
        <h1 className="text-muted-foreground pointer-events-auto">Sign into the</h1>
        <p className="font-chakra-petch text-3xl font-medium text-foreground text-center max-w-md pointer-events-auto">
          MySocial Testnet
        </p>
      </div>
    </div>
  );
}
