import type { Metadata } from "next";
import { Space_Grotesk, Chakra_Petch } from "next/font/google";
import "./globals.css";
import { ReturnOriginPersister } from "@/components/ReturnOriginPersister";

const spaceGrotesk = Space_Grotesk({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const chakraPetch = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chakra-petch",
});

export const metadata: Metadata = {
  title: "MySocial Auth",
  description: "MySocial Auth login server for OAuth with Google, Apple, Facebook, and Twitch",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${chakraPetch.variable} overflow-x-hidden`}>
      <body className={`${spaceGrotesk.className} antialiased m-0 min-h-screen w-full overflow-x-hidden bg-background text-foreground`}>
        <ReturnOriginPersister />
        {children}
      </body>
    </html>
  );
}
