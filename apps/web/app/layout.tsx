import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "./site";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: "An open-source AI image generator using the AI SDK",
  openGraph: { siteName: SITE_NAME },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
