import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clementine — Distributed Local Compute",
  description: "Transform idle home devices into a private compute cluster.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable}`}>
      <body className="mesh-bg min-h-screen antialiased" style={{ fontFamily: "var(--font-plus-jakarta, 'Plus Jakarta Sans'), sans-serif" }}>
        <div className="grainy-bg" />
        {children}
      </body>
    </html>
  );
}
