import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { Shell } from "@/components/shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "./globals.css";
import "./liquid-glass.css";
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});
export const metadata: Metadata = {
  title: {
    default: "AI Productivity Hub — Turn ideas into progress",
    template: "%s | AI Productivity Hub",
  },
  description:
    "Five thoughtful AI tools. One focused workspace. Write, summarize, plan, research, and review with Gemini.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={geist.variable}>
        <WorkspaceProvider>
          <Shell>{children}</Shell>
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
          />
        </WorkspaceProvider>
      </body>
    </html>
  );
}
