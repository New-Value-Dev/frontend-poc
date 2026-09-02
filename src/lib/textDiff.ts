import { diffWordsWithSpace } from "diff";
import type { DiffResult, DiffToken, SectionDiff } from "./types";

function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/);
}

function buildSection(from: string, to: string): SectionDiff {
  const tokens: DiffToken[] = diffWordsWithSpace(from, to).map((c) => ({
    op: c.added ? "insert" : c.removed ? "delete" : "equal",
    text: c.value,
  }));
  const op: SectionDiff["op"] =
    from === to ? "unchanged" : from === "" ? "added" : to === "" ? "deleted" : "modified";
  return {
    op,
    from_section_id: null,
    to_section_id: null,
    level: null,
    section_type: null,
    title: null,
    tokens,
  };
}

export function diffText(from: string, to: string): DiffResult {
  const fromParas = splitParagraphs(from);
  const toParas = splitParagraphs(to);
  const sections: SectionDiff[] =
    fromParas.length === toParas.length
      ? fromParas.map((p, i) => buildSection(p, toParas[i]))
      : [buildSection(from, to)];

  const summary = sections.reduce(
    (acc, s) => {
      acc[s.op] += 1;
      return acc;
    },
    { added: 0, deleted: 0, modified: 0, unchanged: 0 },
  );

  return {
    document_id: 0,
    from_version: { id: 0, version_no: 0 },
    to_version: { id: 0, version_no: 0 },
    sections,
    summary,
  };
}
