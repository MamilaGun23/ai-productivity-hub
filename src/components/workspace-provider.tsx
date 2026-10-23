"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  historyEntrySchema,
  type Draft,
  type Feature,
  type HistoryEntry,
} from "@/lib/contracts";
import {
  HISTORY_KEY,
  PREF_KEY,
  readHistory,
  writeHistory,
} from "@/lib/storage";

type WorkspaceContext = {
  entries: HistoryEntry[];
  enabled: boolean;
  ready: boolean;
  save: (draft: Draft, id?: string) => string | undefined;
  remove: (id: string) => void;
  clear: () => void;
  setEnabled: (enabled: boolean) => void;
  drafts: Partial<Record<Feature, Draft>>;
  setDraft: (draft: Draft) => void;
};
const Context = createContext<WorkspaceContext | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [enabled, updateEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<Feature, Draft>>>({});
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        setEntries(readHistory(localStorage));
        updateEnabled(localStorage.getItem(PREF_KEY) === "true");
      } catch {
        toast.error(
          "Local history is unavailable or damaged. You can still use every AI tool; reset storage in Settings.",
        );
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  const setDraft = useCallback(
    (draft: Draft) =>
      setDrafts((previous) => ({ ...previous, [draft.feature]: draft })),
    [],
  );
  function persist(next: HistoryEntry[]) {
    try {
      writeHistory(localStorage, next);
      setEntries(next);
      return true;
    } catch {
      toast.error(
        "Could not save locally. Browser storage may be full or blocked. Export a copy instead.",
      );
      return false;
    }
  }
  function save(draft: Draft, id?: string) {
    if (!enabled) {
      toast.error(
        "Enable local history in Settings to save content on this browser.",
      );
      return;
    }
    const now = new Date().toISOString();
    const entryResult = historyEntrySchema.safeParse({
      ...draft,
      id: id ?? draft.savedId ?? crypto.randomUUID(),
      createdAt:
        entries.find((e) => e.id === (id ?? draft.savedId))?.createdAt ?? now,
      updatedAt: now,
    });
    if (!entryResult.success) {
      toast.error(
        "This draft exceeds the saved-content limits or contains an invalid field. Check your edits, or export a copy instead.",
      );
      return;
    }
    const entry = entryResult.data;
    if (
      persist([entry, ...entries.filter((e) => e.id !== entry.id)].slice(0, 50))
    ) {
      toast.success("Saved on this browser");
      return entry.id;
    }
  }
  function clear() {
    try {
      localStorage.removeItem(HISTORY_KEY);
      setEntries([]);
      toast.success("Saved history cleared");
    } catch {
      toast.error("Your browser blocked access to local storage.");
    }
  }
  function setEnabled(value: boolean) {
    try {
      localStorage.setItem(PREF_KEY, String(value));
      updateEnabled(value);
    } catch {
      toast.error("Your browser blocked preferences storage.");
    }
  }
  return (
    <Context.Provider
      value={{
        entries,
        enabled,
        ready,
        save,
        remove: (id) => {
          persist(entries.filter((e) => e.id !== id));
        },
        clear,
        setEnabled,
        drafts,
        setDraft,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace provider missing");
  return value;
}
