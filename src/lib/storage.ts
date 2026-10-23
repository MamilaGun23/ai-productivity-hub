import { historySchema, type HistoryEntry } from "./contracts";
export const HISTORY_KEY = "aph:history:v1";
export const PREF_KEY = "aph:history-enabled";
export function readHistory(storage: Pick<Storage, "getItem">): HistoryEntry[] {
  const raw = storage.getItem(HISTORY_KEY);
  if (!raw) return [];
  const result = historySchema.safeParse(JSON.parse(raw));
  if (!result.success)
    throw new Error(
      "Saved history could not be restored. Clear local data in Settings to reset it.",
    );
  return result.data.entries;
}
export function writeHistory(
  storage: Pick<Storage, "setItem">,
  entries: HistoryEntry[],
) {
  storage.setItem(
    HISTORY_KEY,
    JSON.stringify(
      historySchema.parse({ version: 1, entries: entries.slice(0, 50) }),
    ),
  );
}
