import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "NEXUS · AI Prediction Terminal · Win Go",
  description:
    "Futuristic AI prediction terminal for Win Go — multi-engine trend analysis, 3-level recovery plan, and mathematical jackpot digit forecasting.",
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} bg-obsidian`}>
      <body className="min-h-screen bg-obsidian text-slate-200 antialiased">{children}</body>
    </html>
  );
}
