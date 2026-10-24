"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  History,
  Settings2,
  CircleHelp,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";
import { features } from "@/lib/config";
import { BrandLogo } from "@/components/branding/brand-logo";
import { GlassSidebar, GlassTooltip } from "@/components/glass";
import { CommandBar } from "@/components/dashboard/command-bar";
import { useWorkspace } from "./workspace-provider";
const supporting = [
  { href: "/history", name: "History", icon: History },
  { href: "/settings", name: "Settings", icon: Settings2 },
  { href: "/about", name: "About & responsible AI", icon: CircleHelp },
];
function Sidebar({
  close,
  collapsed = false,
}: {
  close?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const item = (href: string, name: string, Icon: LucideIcon) => {
    const link = (
      <Link
        onClick={close}
        href={href}
        className={`nav-item ${pathname === href ? "active" : ""}`}
        aria-label={name}
        aria-current={pathname === href ? "page" : undefined}
      >
        <Icon size={19} />
        {!collapsed && <span>{name}</span>}
      </Link>
    );
    return <GlassTooltip label={name}>{link}</GlassTooltip>;
  };
  return (
    <>
      <Link
        className="brand"
        href="/"
        onClick={close}
        aria-label="AI Productivity Hub home"
      >
        <BrandLogo compact={collapsed} />
      </Link>
      <div className="nav-content">
        <span className="nav-label">
          {collapsed ? "HUB" : "YOUR WORKSPACE"}
        </span>
        <nav aria-label="Main navigation">
          {item("/", "Dashboard", LayoutDashboard)}
          <span className="nav-label tools-label">
            {collapsed ? "AI" : "AI TOOLS"}
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
        {!collapsed && (
          <div className="privacy-card">
            <LockKeyhole size={17} />
            <strong>A workspace of your own</strong>
            <p>No account needed. Local data stays in this browser.</p>
            <Link href="/settings" onClick={close}>
              Manage your data <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
        <div className="sidebar-footer">
          <span className="status-dot" />
          {!collapsed && "Powered by Gemini"}
        </div>
      </div>
    </>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const compact = window.matchMedia(
      "(min-width: 601px) and (max-width: 1000px)",
    );
    const restore = () => {
      try {
        const preference = localStorage.getItem("aph:sidebar-collapsed");
        setCollapsed(
          preference === null ? compact.matches : preference === "true",
        );
      } catch {
        setCollapsed(compact.matches);
      }
    };
    queueMicrotask(restore);
    compact.addEventListener("change", restore);
    return () => compact.removeEventListener("change", restore);
  }, []);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("aph:sidebar-collapsed", String(next));
    } catch {
      /* In-memory preference remains. */
    }
  }
  const current = features.find((f) => pathname === `/${f.id}`);
  const title =
    current?.name ??
    {
      "/": "Dashboard",
      "/history": "Saved workspace",
      "/settings": "Settings",
      "/about": "About & responsible AI",
    }[pathname] ??
    "Workspace";
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <GlassSidebar className="sidebar desktop-sidebar">
        <Sidebar collapsed={collapsed} />
        <button
          className="sidebar-toggle icon-button"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={toggle}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </GlassSidebar>
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
          {pathname !== "/" && <CommandBar key={pathname} compact />}
          <Link href="/settings" className="topbar-badge">
            <span className="status-dot" />
            Browser workspace
          </Link>
        </header>
        {workspace.storageError && (
          <div className="storage-banner" role="alert">
            {workspace.storageError}{" "}
            <button type="button" onClick={() => void workspace.exportData()}>
              Export a recovery copy
            </button>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="page-footer">
          <span>
            AI Productivity Hub{" "}
            <span className="muted">· A little clarity. More possibility.</span>
          </span>
          <Link href="/about">Powered by AI. Guided by you.</Link>
        </footer>
      </div>
    </div>
  );
}
