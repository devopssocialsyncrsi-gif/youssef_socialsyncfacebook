import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "../../frontend/src/styles.css";

export const metadata: Metadata = {
  title: "SocialSync — Your content, everywhere",
  description: "Create once, share everywhere. A simpler way to publish across your social channels.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
