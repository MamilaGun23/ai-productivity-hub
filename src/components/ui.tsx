"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X, ShieldCheck, Download, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { download } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";
export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      type="button"
      className={`button ${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  return (
    <Button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copied to clipboard");
        } catch {
          toast.error(
            "Clipboard access is blocked. Select and copy the text manually.",
          );
        }
      }}
    >
      <Copy size={15} />
      {label}
    </Button>
  );
}
export function ExportButton({
  text,
  name,
  mime,
}: {
  text: string;
  name: string;
  mime?: string;
}) {
  return (
    <Button onClick={() => download(text, name, mime)}>
      <Download size={15} />
      Export{" "}
      {name.endsWith(".csv")
        ? "CSV"
        : name.endsWith(".txt")
          ? "text"
          : "Markdown"}
    </Button>
  );
}
export function ResponsibleReminder() {
  return (
    <p className="responsible">
      <ShieldCheck size={15} />
      AI can make mistakes. Review important details. Avoid confidential
      information.
    </p>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={23} />
      <strong>Making room for your best work</strong>
      <span>Gemini is preparing your response…</span>
    </div>
  );
}
export function ConfirmDialog({
  trigger,
  title,
  description,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <div className="actions">
            <Dialog.Close asChild>
              <Button>Cancel</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button variant="danger" onClick={onConfirm}>
                Delete
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Close className="dialog-close" aria-label="Close dialog">
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
