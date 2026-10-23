import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Shell } from "@/components/shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "AI Productivity Hub — Your space to do more",
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
      <body>
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
