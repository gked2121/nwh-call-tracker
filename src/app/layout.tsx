import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://nwh-call-tracker.vercel.app'),
  title: "NWH Call Analysis | AI-Powered Sales Intelligence",
  description: "Analyze sales call transcripts to score rep performance, identify hot leads, and get AI-powered coaching insights. Upload your CallRail export and get actionable intelligence in minutes.",
  keywords: ["sales analytics", "call tracking", "AI analysis", "sales coaching", "lead scoring", "CallRail", "sales performance"],
  authors: [{ name: "NWH" }],
  openGraph: {
    title: "NWH Call Analysis | AI-Powered Sales Intelligence",
    description: "Score reps, find hot leads, and get AI coaching insights from your sales calls.",
    type: "website",
    locale: "en_US",
    siteName: "NWH Call Analysis",
  },
  twitter: {
    card: "summary_large_image",
    title: "NWH Call Analysis | AI-Powered Sales Intelligence",
    description: "Score reps, find hot leads, and get AI coaching insights from your sales calls.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} antialiased bg-[#F4F7FE] text-[#1B254B]`}
      >
        {children}
      </body>
    </html>
  );
}
