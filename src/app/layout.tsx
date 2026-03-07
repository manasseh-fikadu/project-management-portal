import type { Metadata } from "next";
import { headers } from "next/headers";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MoTRI - Project Management Portal",
  description: "Ministry of Trade and Regional Integration - Project Management Portal",
  icons: {
    icon: "/motri.png",
    apple: "/motri.png",
  },
};

function getInitialLanguage(acceptLanguage: string | null) {
  if (acceptLanguage?.toLowerCase().includes("am")) {
    return "am";
  }

  return "en";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const acceptLanguage = (await headers()).get("accept-language");
  const initialLanguage = getInitialLanguage(acceptLanguage);

  return (
    <html lang={initialLanguage}>
      <body
        className={`${dmSans.variable} ${dmSerif.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders preferredLanguage={initialLanguage}>{children}</AppProviders>
      </body>
    </html>
  );
}
