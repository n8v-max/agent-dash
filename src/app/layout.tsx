import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  // The shell is the first thing a reviewer sees, and the browser tab is part of it.
  title: { default: "agent-dash", template: "%s · agent-dash" },
  description:
    "Organisation-level analytics for agent execution: what it costs, and what it completed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
