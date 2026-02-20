import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arc -- Ask your database anything",
  description:
    "Arc is a conversational database tool built on the Glove framework by dterminal. Query your databases with natural language.",
  openGraph: {
    title: "Arc -- Ask your database anything",
    description:
      "A conversational database tool built on Glove. Query your databases with natural language.",
    images: [{ url: "/arc-og-banner.png" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arc -- Ask your database anything",
    description:
      "A conversational database tool built on Glove. Query your databases with natural language.",
    images: ["/arc-og-banner.png"],
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
        className={`${instrumentSerif.variable} ${dmSans.variable} ${dmMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
