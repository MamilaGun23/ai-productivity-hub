"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import {
  LayoutDashboard,
  History,
  Settings2,
  CircleHelp,
  Sparkles,
  Menu,
  X,
  ArrowUpRight,
  LockKeyhole,
} from "lucide-react";
import { features } from "@/lib/config";
import type { ReactNode } from "react";
const supporting = [
  { href: "/history", name: "History", icon: History },
  { href: "/settings", name: "Settings", icon: Settings2 },
  { href: "/about", name: "About & responsible AI", icon: CircleHelp },
];
function Sidebar({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const item = (href: string, name: string, Icon: typeof Sparkles) => (
    <Link
      onClick={close}
      href={href}
      className={`nav-item ${pathname === href ? "active" : ""}`}
      aria-current={pathname === href ? "page" : undefined}
    >
      <Icon size={18} />
      <span>{name}</span>
      {pathname === href && <span className="active-dot" />}
    </Link>
  );
  return (
    <>
      <Link className="brand" href="/" onClick={close}>
        <span className="brand-mark">
          <Sparkles size={22} />
        </span>
        <span>
          Productivity
          <span className="brand-sub">
            HUB <span>· AI WORKSPACE</span>
          </span>
        </span>
      </Link>
      <div className="nav-content">
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {item("/", "Overview", LayoutDashboard)}
          <span className="nav-label tools-label">
            YOUR AI TOOLKIT <span>5</span>
          </span>
          {features.map((f) => (
            <div key={f.id}>{item(`/${f.id}`, f.name, f.icon)}</div>
          ))}
        </nav>
        <div className="nav-divider" />
        <nav aria-label="Workspace settings">
          {supporting.map((s) => (
            <div key={s.href}>{item(s.href, s.name, s.icon)}</div>
          ))}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="privacy-card">
          <span className="privacy-icon">
            <LockKeyhole size={17} />
          </span>
          <strong>Your space. Your control.</strong>
          <p>No accounts. Save only what you choose, on your browser.</p>
          <Link href="/about" onClick={close}>
            Built with responsible AI <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" />
          Powered by Gemini<span>v1.0</span>
        </div>
      </div>
    </>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = features.find((f) => pathname === `/${f.id}`);
  const title =
    current?.fullName ??
    {
      "/": "Workspace overview",
      "/history": "Workspace history",
      "/settings": "Settings",
      "/about": "About & responsible AI",
    }[pathname] ??
    "Workspace";
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar desktop-sidebar">
        <Sidebar />
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger
                className="icon-button mobile-menu"
                aria-label="Open navigation"
              >
                <Menu size={21} />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay" />
                <Dialog.Content className="mobile-sidebar sidebar">
                  <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Choose a workspace tool.
                  </Dialog.Description>
                  <Dialog.Close
                    className="drawer-close icon-button"
                    aria-label="Close navigation"
                  >
                    <X size={20} />
                  </Dialog.Close>
                  <Sidebar close={() => setOpen(false)} />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <span className="breadcrumb-parent">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{title}</strong>
          </div>
          <Link href="/about" className="topbar-badge">
            <span className="status-dot" />
            No account needed <ArrowUpRight size={13} />
          </Link>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="page-footer">
          <span>
            AI Productivity Hub{" "}
            <span className="muted">· Built for thoughtful work</span>
          </span>
          <Link href="/about">Human judgment. Always.</Link>
        </footer>
      </div>
    </div>
  );
}
