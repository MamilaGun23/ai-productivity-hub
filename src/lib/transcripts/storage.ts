import type { TranscriptJob, TranscriptNode } from "./contracts";
const DATABASE = "aph-transcripts";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "This browser cannot save transcript jobs. Enable browser storage to continue.",
        ),
      );
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("jobs", { keyPath: "id" });
      database.createObjectStore("sources", { keyPath: "id" });
      database
        .createObjectStore("nodes", { keyPath: "id" })
        .createIndex("jobId", "jobId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Transcript storage could not be opened. Check browser storage permissions.",
        ),
      );
    request.onblocked = () =>
      reject(
        new Error(
          "Another tab is updating transcript storage. Close it and retry.",
        ),
      );
  });
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let request: IDBRequest<T>;
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(
        new Error(
          "Transcript storage is full or unavailable. Free browser storage and retry; keep your source file.",
        ),
      );
    };
    try {
      request = run(tx.objectStore(store));
    } catch {
      tx.abort();
    }
  });
}
export const saveTranscriptJob = (job: TranscriptJob) =>
  transaction("jobs", "readwrite", (store) => store.put(job));
export const getTranscriptJob = (id: string) =>
  transaction<TranscriptJob | undefined>("jobs", "readonly", (store) =>
    store.get(id),
  );
export const listTranscriptJobs = () =>
  transaction<TranscriptJob[]>("jobs", "readonly", (store) => store.getAll());
export const saveTranscriptSource = (id: string, text: string) =>
  transaction("sources", "readwrite", (store) => store.put({ id, text }));
export async function getTranscriptSource(id: string) {
  return (
    await transaction<{ id: string; text: string } | undefined>(
      "sources",
      "readonly",
      (store) => store.get(id),
    )
  )?.text;
}
export const getTranscriptNodes = (id: string) =>
  transaction<TranscriptNode[]>("nodes", "readonly", (store) =>
    store.index("jobId").getAll(id),
  );
export const saveTranscriptNode = (node: TranscriptNode) =>
  transaction("nodes", "readwrite", (store) => store.put(node));
export async function removeTranscriptJob(id: string) {
  const nodes = await getTranscriptNodes(id);
  for (const node of nodes)
    await transaction("nodes", "readwrite", (store) => store.delete(node.id));
  await transaction("sources", "readwrite", (store) => store.delete(id));
  await transaction("jobs", "readwrite", (store) => store.delete(id));
}
export async function exportTranscriptJobs() {
  const jobs = await listTranscriptJobs();
  return Promise.all(
    jobs.map(async (job) => ({
      ...job,
      source: await getTranscriptSource(job.id),
      sections: await getTranscriptNodes(job.id),
    })),
  );
}
export async function clearTranscriptJobs() {
  for (const store of ["jobs", "sources", "nodes"])
    await transaction(store, "readwrite", (value) => value.clear());
}
/** Storage boundary for an optional durable server implementation. The default is browser-only IndexedDB. */
export interface TranscriptJobStore {
  getJob(id: string): Promise<TranscriptJob | undefined>;
  saveJob(job: TranscriptJob): Promise<unknown>;
  getSource(id: string): Promise<string | undefined>;
  saveSource(id: string, text: string): Promise<unknown>;
  getNodes(id: string): Promise<TranscriptNode[]>;
  saveNode(node: TranscriptNode): Promise<unknown>;
}
export const indexedDbTranscriptStore: TranscriptJobStore = {
  getJob: getTranscriptJob,
  saveJob: saveTranscriptJob,
  getSource: getTranscriptSource,
  saveSource: saveTranscriptSource,
  getNodes: getTranscriptNodes,
  saveNode: saveTranscriptNode,
};
