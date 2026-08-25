import { api } from "./api";
import type { DiffResult } from "./types";


export function getDocumentDiff(docId: string, fromVersionId: number, toVersionId: number) {
  return api.get<DiffResult>(
    `/documents/${docId}/diff?from_version_id=${fromVersionId}&to_version_id=${toVersionId}`,
  );
}
