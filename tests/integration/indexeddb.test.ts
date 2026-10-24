import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  openWorkspaceDatabase,
  readWorkspace,
  writeWorkspace,
} from "../../src/lib/indexeddb";
import { emptyWorkspace, makeTask } from "../../src/lib/local-data";

beforeEach(async () => {
  const database = await openWorkspaceDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("workspace", "readwrite");
    transaction.objectStore("workspace").clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
});
describe("IndexedDB workspace transactions", () => {
  it("round-trips data and rejects stale writes without deleting newer saved work", async () => {
    const initial = await readWorkspace();
    const task = makeTask({ title: "Keep this work" });
    await writeWorkspace({ ...initial, revision: 1, tasks: [task] });
    await expect(
      writeWorkspace({ ...initial, revision: 1, tasks: [] }),
    ).rejects.toMatchObject({ name: "WorkspaceConflictError" });
    const restored = await readWorkspace();
    expect(restored.tasks).toEqual([task]);
    expect(restored.revision).toBe(1);
  });
  it("requires an explicit reset to replace data that cannot be restored", async () => {
    const database = await openWorkspaceDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("workspace", "readwrite");
      transaction
        .objectStore("workspace")
        .put({ invalid: true, revision: 5 }, "data");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    await expect(readWorkspace()).rejects.toThrow();
    await expect(
      writeWorkspace({ ...emptyWorkspace(), revision: 1 }),
    ).rejects.toMatchObject({ name: "WorkspaceConflictError" });
    const resetRevision = await writeWorkspace(
      { ...emptyWorkspace(), revision: 1 },
      { force: true },
    );
    expect(resetRevision).toBe(6);
    expect((await readWorkspace()).tasks).toEqual([]);
  });
});
