"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  historyEntrySchema,
  type Draft,
  type Feature,
  type HistoryEntry,
  type Task,
} from "@/lib/contracts";
import { HISTORY_KEY, PREF_KEY } from "@/lib/storage";
import {
  migrateLegacyHistory,
  readWorkspace,
  writeWorkspace,
} from "@/lib/indexeddb";
import {
  calendarEventSchema,
  changeTask,
  emptyWorkspace,
  makeTask,
  usageEventSchema,
  type CalendarEvent,
  type LocalTask,
  type LocalWorkspace,
  type NewCalendarEvent,
  type NewTask,
  type UsageEvent,
} from "@/lib/local-data";
import {
  promptExperimentSchema,
  type PromptExperiment,
  type ExperimentDraft,
} from "@/lib/experiments";
import { download } from "@/lib/utils";

type WorkspaceContext = {
  entries: HistoryEntry[];
  enabled: boolean;
  ready: boolean;
  storageError: string;
  save: (draft: Draft, id?: string) => string | undefined;
  remove: (id: string) => void;
  clear: () => void;
  setEnabled: (enabled: boolean) => void;
  drafts: Partial<Record<Feature, Draft>>;
  setDraft: (draft: Draft) => void;
  openDraft: (draft: Draft) => void;
  draftLaunches: Partial<Record<Feature, number>>;
  experimentDraft?: ExperimentDraft;
  setExperimentDraft: (draft: ExperimentDraft) => void;
  tasks: LocalTask[];
  events: CalendarEvent[];
  usage: UsageEvent[];
  experiments: PromptExperiment[];
  addTask: (input: NewTask) => Promise<string | undefined>;
  addTasks: (input: NewTask[]) => Promise<string[] | undefined>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<boolean>;
  removeTask: (id: string) => Promise<boolean>;
  addEvent: (input: NewCalendarEvent) => Promise<string | undefined>;
  updateEvent: (
    id: string,
    patch: Partial<NewCalendarEvent>,
  ) => Promise<boolean>;
  removeEvent: (id: string) => Promise<boolean>;
  recordUsage: (
    feature: Feature,
    status?: "success" | "error",
    kind?: string,
  ) => Promise<boolean>;
  saveExperiment: (experiment: PromptExperiment) => Promise<boolean>;
  removeExperiment: (id: string) => Promise<boolean>;
  exportData: () => Promise<void>;
  clearAll: () => Promise<boolean>;
};
const Context = createContext<WorkspaceContext | null>(null);
const STORAGE_ERROR =
  "Changes are in memory but could not be saved on this browser. Storage may be full or blocked. Export your work before closing this tab.";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LocalWorkspace>(emptyWorkspace);
  const dataRef = useRef(data);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const diskRevision = useRef(0);
  const blocked = useRef("");
  const [enabled, updateEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [drafts, setDrafts] = useState<Partial<Record<Feature, Draft>>>({});
  const [draftLaunches, setDraftLaunches] = useState<
    Partial<Record<Feature, number>>
  >({});
  const [experimentDraft, setExperimentDraft] = useState<ExperimentDraft>();

  useEffect(() => {
    let active = true;
    (async () => {
      let restored = emptyWorkspace();
      let error = "";
      try {
        restored = await readWorkspace();
        try {
          restored = await migrateLegacyHistory(localStorage, restored);
        } catch {
          // Another tab or Strict Mode hydration may have completed migration.
          restored = await readWorkspace();
          if (localStorage.getItem(HISTORY_KEY))
            error =
              "Legacy history could not be migrated. Its original copy was kept. Export or clear it in Settings.";
        }
      } catch {
        error =
          "Saved workspace data is unavailable or damaged. You can work in this tab and export a copy; check browser storage permissions in Settings.";
        if (active) blocked.current = error;
      }
      let preference = false;
      try {
        preference = localStorage.getItem(PREF_KEY) === "true";
      } catch {
        error ||= "This browser blocked preferences storage.";
      }
      if (!active) return;
      dataRef.current = restored;
      diskRevision.current = restored.revision;
      setData(restored);
      updateEnabled(preference);
      setStorageError(error);
      setReady(true);
      if (error) toast.error(error);
    })();
    return () => {
      active = false;
    };
  }, []);

  const commit = useCallback(
    (
      next: LocalWorkspace,
      success?: string,
      force = false,
    ): Promise<boolean> => {
      dataRef.current = next;
      setData(next);
      const pending = queue.current
        .catch(() => {})
        .then(async () => {
          if (blocked.current && !force) {
            setStorageError(blocked.current);
            return false;
          }
          try {
            const revision = diskRevision.current + 1;
            const committedRevision = await writeWorkspace(
              { ...next, revision },
              { force },
            );
            diskRevision.current = committedRevision ?? revision;
            if (force) blocked.current = "";
            setStorageError("");
            if (success) toast.success(success);
            return true;
          } catch (error) {
            const message =
              error instanceof Error && error.name === "WorkspaceConflictError"
                ? error.message
                : STORAGE_ERROR;
            if (
              error instanceof Error &&
              error.name === "WorkspaceConflictError"
            )
              blocked.current = message;
            setStorageError(message);
            toast.error(message);
            return false;
          }
        });
      queue.current = pending;
      return pending;
    },
    [],
  );
  const setDraft = useCallback(
    (draft: Draft) =>
      setDrafts((previous) => ({ ...previous, [draft.feature]: draft })),
    [],
  );
  const openDraft = useCallback((draft: Draft) => {
    setDrafts((previous) => ({ ...previous, [draft.feature]: draft }));
    setDraftLaunches((previous) => ({
      ...previous,
      [draft.feature]: (previous[draft.feature] ?? 0) + 1,
    }));
  }, []);
  const requireReady = () => {
    if (!ready) {
      toast.error(
        "Your local workspace is still loading. Please try again in a moment.",
      );
      return false;
    }
    return true;
  };
  function save(draft: Draft, id?: string) {
    if (!requireReady()) return;
    if (!enabled) {
      toast.error(
        "Enable local history in Settings to save content on this browser.",
      );
      return;
    }
    const now = new Date().toISOString();
    const input = { ...draft.input };
    if (input.transcriptJobId) delete input.transcript;
    const result = historyEntrySchema.safeParse({
      ...draft,
      input,
      id: id ?? draft.savedId ?? crypto.randomUUID(),
      createdAt:
        dataRef.current.entries.find((e) => e.id === (id ?? draft.savedId))
          ?.createdAt ?? now,
      updatedAt: now,
    });
    if (!result.success) {
      toast.error(
        "This draft contains an invalid field or exceeds the saved-content limits. Export a copy instead.",
      );
      return;
    }
    const entry = result.data;
    void commit(
      {
        ...dataRef.current,
        entries: [
          entry,
          ...dataRef.current.entries.filter((e) => e.id !== entry.id),
        ],
      },
      "Saved on this browser",
    );
    return entry.id;
  }
  function clear() {
    if (!requireReady()) return;
    void commit(
      { ...dataRef.current, entries: [] },
      "Saved history cleared",
    ).then((saved) => {
      if (saved)
        try {
          localStorage.removeItem(HISTORY_KEY);
        } catch {
          setStorageError(
            "Saved history was cleared, but this browser blocked removal of a legacy copy.",
          );
        }
    });
  }
  function setEnabled(value: boolean) {
    try {
      localStorage.setItem(PREF_KEY, String(value));
      updateEnabled(value);
    } catch {
      toast.error("Your browser blocked preferences storage.");
    }
  }
  async function addTask(input: NewTask) {
    if (!requireReady()) return;
    try {
      const task = makeTask(input);
      return (await commit({
        ...dataRef.current,
        tasks: [
          ...dataRef.current.tasks.filter(
            (existing) => existing.id !== task.id,
          ),
          task,
        ],
      }))
        ? task.id
        : undefined;
    } catch {
      toast.error("Add a title and valid task details.");
    }
  }
  async function updateTask(id: string, patch: Partial<Task>) {
    if (!requireReady()) return false;
    try {
      return await commit({
        ...dataRef.current,
        tasks: dataRef.current.tasks.map((task) =>
          task.id === id ? changeTask(task, patch) : task,
        ),
      });
    } catch {
      toast.error("Task changes contain an invalid field.");
      return false;
    }
  }
  async function removeTask(id: string) {
    if (!requireReady()) return false;
    return commit({
      ...dataRef.current,
      tasks: dataRef.current.tasks
        .filter((t) => t.id !== id)
        .map((t) => ({
          ...t,
          dependencies: t.dependencies.filter(
            (dependency) => dependency !== id,
          ),
        })),
      events: dataRef.current.events.filter((event) => event.taskId !== id),
    });
  }
  async function addTasks(inputs: NewTask[]) {
    if (!requireReady()) return;
    try {
      const current = new Set(dataRef.current.tasks.map((task) => task.id));
      const additions = inputs
        .map((input) => makeTask(input))
        .filter((task) => !current.has(task.id));
      if (new Set(additions.map((task) => task.id)).size !== additions.length)
        throw new Error("Duplicate task identifiers.");
      if (
        await commit({
          ...dataRef.current,
          tasks: [...dataRef.current.tasks, ...additions],
        })
      )
        return additions.map((task) => task.id);
    } catch {
      toast.error(
        "These tasks contain an invalid field. Review the plan before adding it.",
      );
    }
  }
  async function addEvent(input: NewCalendarEvent) {
    if (!requireReady()) return;
    const now = new Date().toISOString();
    const result = calendarEventSchema.safeParse({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
    if (!result.success) {
      toast.error("Add an event title and valid date and time.");
      return;
    }
    return (await commit({
      ...dataRef.current,
      events: [
        ...dataRef.current.events.filter(
          (existing) => existing.id !== result.data.id,
        ),
        result.data,
      ],
    }))
      ? result.data.id
      : undefined;
  }
  async function updateEvent(id: string, patch: Partial<NewCalendarEvent>) {
    if (!requireReady()) return false;
    const existing = dataRef.current.events.find((event) => event.id === id);
    if (!existing) return false;
    const result = calendarEventSchema.safeParse({
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    });
    if (!result.success) {
      toast.error("Add an event title and valid date and time.");
      return false;
    }
    return commit({
      ...dataRef.current,
      events: dataRef.current.events.map((event) =>
        event.id === id ? result.data : event,
      ),
    });
  }
  async function recordUsage(
    feature: Feature,
    status: "success" | "error" = "success",
    kind = "generation",
  ) {
    if (!ready) return false;
    const event = usageEventSchema.parse({
      id: crypto.randomUUID(),
      feature,
      status,
      kind,
      createdAt: new Date().toISOString(),
    });
    return commit({
      ...dataRef.current,
      usage: [...dataRef.current.usage, event],
    });
  }
  async function saveExperiment(experiment: PromptExperiment) {
    if (!requireReady()) return false;
    const result = promptExperimentSchema.safeParse(experiment);
    if (!result.success) {
      toast.error(
        "This experiment has invalid content and could not be saved.",
      );
      return false;
    }
    return commit(
      {
        ...dataRef.current,
        experiments: [
          result.data,
          ...dataRef.current.experiments.filter((e) => e.id !== experiment.id),
        ],
      },
      "Experiment saved on this browser",
    );
  }
  async function exportData() {
    try {
      await queue.current;
      let transcriptJobs: unknown = [];
      let transcriptExportError = "";
      try {
        const { exportTranscriptJobs } =
          await import("@/lib/transcripts/storage");
        transcriptJobs = await exportTranscriptJobs();
      } catch {
        transcriptExportError =
          "Transcript storage was unavailable. Transcript jobs could not be included in this export.";
      }
      let legacyHistory: string | null = null;
      try {
        legacyHistory = localStorage.getItem(HISTORY_KEY);
      } catch {
        /* Export available work even if preferences are blocked. */
      }
      download(
        JSON.stringify(
          {
            application: "AI Productivity Hub",
            exportedAt: new Date().toISOString(),
            workspace: dataRef.current,
            transcriptJobs,
            transcriptExportError: transcriptExportError || undefined,
            workspaceExportWarning: blocked.current || undefined,
            legacyHistory: legacyHistory || undefined,
            activeDrafts: drafts,
            activeExperiment: experimentDraft,
          },
          null,
          2,
        ),
        `ai-productivity-hub-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json",
      );
      if (transcriptExportError || blocked.current)
        toast.error(
          "Available workspace data was exported. Some saved data could not be read; see the warnings in your export.",
        );
      else toast.success("Workspace export downloaded");
    } catch {
      toast.error(
        "Could not export all workspace data. Check browser storage access and try again.",
      );
    }
  }
  async function clearAll() {
    if (!requireReady()) return false;
    if (!(await commit(emptyWorkspace(), undefined, true))) return false;
    setDrafts({});
    setExperimentDraft(undefined);
    try {
      const { clearTranscriptJobs } = await import("@/lib/transcripts/storage");
      await clearTranscriptJobs();
      const preferenceKeys = Array.from(
        { length: localStorage.length },
        (_, index) => localStorage.key(index),
      ).filter((key): key is string => Boolean(key?.startsWith("aph:")));
      for (const key of preferenceKeys) localStorage.removeItem(key);
      updateEnabled(false);
      setStorageError("");
      toast.success("All local workspace data cleared");
      return true;
    } catch {
      setStorageError(
        "Workspace records were cleared, but some transcript data or preferences could not be removed. Close other workspace tabs and try again.",
      );
      toast.error("Some local data could not be cleared. Please try again.");
      return false;
    }
  }
  return (
    <Context.Provider
      value={{
        ...data,
        enabled,
        ready,
        storageError,
        save,
        remove: (id) => {
          if (requireReady())
            void commit({
              ...dataRef.current,
              entries: dataRef.current.entries.filter((e) => e.id !== id),
            });
        },
        clear,
        setEnabled,
        drafts,
        setDraft,
        openDraft,
        draftLaunches,
        experimentDraft,
        setExperimentDraft,
        addTask,
        addTasks,
        updateTask,
        removeTask,
        addEvent,
        updateEvent,
        removeEvent: (id) =>
          requireReady()
            ? commit({
                ...dataRef.current,
                events: dataRef.current.events.filter((e) => e.id !== id),
              })
            : Promise.resolve(false),
        recordUsage,
        saveExperiment,
        removeExperiment: (id) =>
          requireReady()
            ? commit({
                ...dataRef.current,
                experiments: dataRef.current.experiments.filter(
                  (e) => e.id !== id,
                ),
              })
            : Promise.resolve(false),
        exportData,
        clearAll,
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
