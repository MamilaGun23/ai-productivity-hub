import {
  localWorkspaceSchema,
  emptyWorkspace,
  type LocalWorkspace,
} from "./local-data";
import { HISTORY_KEY, readHistory } from "./storage";

const DATABASE = "aph-workspace";
const STORE = "workspace";
let connection: Promise<IDBDatabase> | undefined;

export function openWorkspaceDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(
      new Error("IndexedDB is unavailable in this browser."),
    );
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };
      request.onerror = () => {
        connection = undefined;
        reject(
          request.error ?? new Error("Browser storage could not be opened."),
        );
      };
      request.onblocked = () => {
        connection = undefined;
        reject(
          new Error("Close other tabs using this workspace, then reload."),
        );
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
    });
  }
  return connection;
}
export async function readWorkspace(): Promise<LocalWorkspace> {
  const db = await openWorkspaceDatabase();
  const value = await new Promise<unknown>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
  return value === undefined
    ? emptyWorkspace()
    : localWorkspaceSchema.parse(value);
}
export async function writeWorkspace(
  workspace: LocalWorkspace,
  options?: { force?: boolean },
): Promise<number> {
  const value = localWorkspaceSchema.parse(workspace);
  const db = await openWorkspaceDatabase();
  return new Promise<number>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    let conflict: Error | undefined;
    const current = store.get("data");
    current.onsuccess = () => {
      const previous = current.result as { revision?: number } | undefined;
      if (!options?.force && (previous?.revision ?? 0) !== value.revision - 1) {
        conflict = new Error(
          "Another tab changed this workspace. Export changes from this tab, then reload to restore the latest saved data.",
        );
        conflict.name = "WorkspaceConflictError";
        transaction.abort();
        return;
      }
      if (options?.force)
        value.revision = Math.max(
          value.revision,
          (previous?.revision ?? 0) + 1,
        );
      store.put(value, "data");
    };
    transaction.oncomplete = () => resolve(value.revision);
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Browser storage write failed."));
    transaction.onabort = () =>
      reject(
        conflict ??
          transaction.error ??
          new Error("Browser storage write was cancelled."),
      );
  });
}
/** Remove the legacy copy only after the replacement transaction commits. */
export async function migrateLegacyHistory(
  storage: Pick<Storage, "getItem" | "removeItem">,
  current: LocalWorkspace,
  persist: (workspace: LocalWorkspace) => Promise<unknown> = writeWorkspace,
): Promise<LocalWorkspace> {
  if (!storage.getItem(HISTORY_KEY)) return current;
  const legacy = readHistory(storage);
  const ids = new Set(current.entries.map((entry) => entry.id));
  const next = {
    ...current,
    revision: current.revision + 1,
    entries: [
      ...current.entries,
      ...legacy.filter((entry) => !ids.has(entry.id)),
    ],
  };
  await persist(next);
  storage.removeItem(HISTORY_KEY);
  return next;
}
