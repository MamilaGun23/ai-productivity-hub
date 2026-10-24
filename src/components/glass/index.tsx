"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle } from "lucide-react";
import type {
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

export function GlassCard({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`glass-card ${className}`} {...props} />;
}
export function GlassPanel({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={`glass-panel ${className}`} {...props} />;
}
export function GlassSidebar({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <aside className={`glass-sidebar ${className}`} {...props} />;
}
export function GlassButton({
  variant = "secondary",
  loading,
  children,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      className={`button ${variant} glass-button ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="spin" size={16} />}
      {children}
    </button>
  );
}
export function GlassInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`glass-input ${className}`} {...props} />;
}
export function GlassDropdown({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`glass-input ${className}`} {...props} />;
}
export function GlassTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="glass-tooltip">
      {children}
      <span role="tooltip" className="tooltip-content">
        {label}
      </span>
    </span>
  );
}
export function GlassModal({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content glass-modal">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
          <Dialog.Close
            className="dialog-close icon-button"
            aria-label="Close dialog"
          >
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function GlassTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="glass-tabs" aria-label="View options">
      {tabs.map((t) => (
        <button
          type="button"
          key={t.value}
          aria-pressed={value === t.value}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
export function GlassNotification({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`glass-notification ${error ? "error-message" : "info-note"}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function GlassProgressIndicator({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="glass-progress">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <span>
        {label} · {percent}%
      </span>
    </div>
  );
}
