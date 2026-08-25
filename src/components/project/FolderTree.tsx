import { useState, type DragEvent, type KeyboardEvent, type FocusEvent } from "react";
import type { Folder } from "@/lib/types";

type FolderNode = Folder & { children: FolderNode[] };

/** 형제는 `rank` 오름차순으로 정렬한다 — 백엔드가 `/folders/{id}/reorder`로 부여하는 순서. */
function buildTree(folders: Folder[]): FolderNode[] {
  const map = new Map<number, FolderNode>();
  folders.forEach((f) => map.set(f.id, { ...f, children: [] }));
  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    const parent = node.parent_id != null ? map.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (ns: FolderNode[]) => {
    ns.sort((a, b) => a.rank - b.rank);
    ns.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** 들여쓰기된 <select> 옵션용으로 depth-first 평탄화한 목록. */
export function flattenFolders(folders: Folder[]): { id: number; name: string; depth: number }[] {
  const out: { id: number; name: string; depth: number }[] = [];
  const walk = (ns: FolderNode[], depth: number) => {
    for (const n of ns) {
      out.push({ id: n.id, name: n.name, depth });
      walk(n.children, depth + 1);
    }
  };
  walk(buildTree(folders), 0);
  return out;
}

/** activeFolder부터 루트까지의 조상 체인 (루트 → 자기 자신 순서). 브레드크럼용. */
export function folderPath(folderId: number | null, folders: Folder[]): Folder[] {
  if (folderId == null) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: Folder[] = [];
  let cur = byId.get(folderId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id != null ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

/** 폴더 id와 그 하위 폴더 전체 — "하위 폴더 포함" 필터링용. */
export function descendantIds(folderId: number, folders: Folder[]): Set<number> {
  const childrenOf = new Map<number, number[]>();
  folders.forEach((f) => {
    if (f.parent_id != null) {
      const arr = childrenOf.get(f.parent_id) ?? [];
      arr.push(f.id);
      childrenOf.set(f.parent_id, arr);
    }
  });
  const set = new Set<number>([folderId]);
  const stack = [folderId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of childrenOf.get(cur) ?? []) {
      if (!set.has(c)) {
        set.add(c);
        stack.push(c);
      }
    }
  }
  return set;
}

export const DOCUMENT_DRAG_TYPE = "application/x-document-id";

export function FolderTree({
  folders,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onReorder,
  onDropDocument,
}: {
  folders: Folder[];
  activeId: number | null;
  onSelect: (id: number | null) => void;
  onNew: () => void;
  onRename?: (f: Folder, name: string) => void;
  onDelete?: (f: Folder) => void;
  onReorder?: (folderId: number, parentId: number | null, targetIndex: number) => void;
  onDropDocument?: (documentId: number, folderId: number | null) => void;
}) {
  const tree = buildTree(folders);
  const [rootOver, setRootOver] = useState(false);

  function readDocumentId(e: DragEvent): number | null {
    if (!e.dataTransfer.types.includes(DOCUMENT_DRAG_TYPE)) return null;
    const raw = e.dataTransfer.getData(DOCUMENT_DRAG_TYPE);
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-ink-muted">폴더</span>
        <button
          type="button"
          onClick={onNew}
          className="text-sm text-ink-muted hover:text-ink hover:underline"
          aria-label="새 폴더"
        >
          ＋
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        <li
          onDragOver={(e) => {
            if (!onDropDocument || !e.dataTransfer.types.includes(DOCUMENT_DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!rootOver) setRootOver(true);
          }}
          onDragLeave={() => setRootOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setRootOver(false);
            const docId = readDocumentId(e);
            if (docId != null) onDropDocument?.(docId, null);
          }}
          className={rootOver ? "rounded-md ring-2 ring-inset ring-ink/30" : undefined}
        >
          <FolderRow label="전체" active={activeId == null} depth={0} onClick={() => onSelect(null)} />
        </li>
      </ul>
      <FolderList
        nodes={tree}
        parentId={null}
        depth={0}
        activeId={activeId}
        onSelect={onSelect}
        onRename={onRename}
        onDelete={onDelete}
        onReorder={onReorder}
        onDropDocument={onDropDocument}
      />
    </div>
  );
}

function FolderList({
  nodes,
  parentId,
  depth,
  activeId,
  onSelect,
  onRename,
  onDelete,
  onReorder,
  onDropDocument,
}: {
  nodes: FolderNode[];
  parentId: number | null;
  depth: number;
  activeId: number | null;
  onSelect: (id: number | null) => void;
  onRename?: (f: Folder, name: string) => void;
  onDelete?: (f: Folder) => void;
  onReorder?: (folderId: number, parentId: number | null, targetIndex: number) => void;
  onDropDocument?: (documentId: number, folderId: number | null) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  function handleFolderReorderDrop(targetId: number) {
    if (onReorder && dragId != null && dragId !== targetId) {
      const ids = nodes.map((n) => n.id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      if (from !== -1 && to !== -1) {
        ids.splice(from, 1);
        ids.splice(to, 0, dragId);
        onReorder(dragId, parentId, ids.indexOf(dragId));
      }
    }
    setDragId(null);
    setOverId(null);
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((n) => {
        const isDocDrag = (e: DragEvent) => e.dataTransfer.types.includes(DOCUMENT_DRAG_TYPE);
        return (
          <li
            key={n.id}
            draggable={!!onReorder && editingId !== n.id}
            onDragStart={(e) => {
              setDragId(n.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (isDocDrag(e)) {
                if (!onDropDocument) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overId !== n.id) setOverId(n.id);
                return;
              }
              if (!onReorder || dragId == null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overId !== n.id) setOverId(n.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (isDocDrag(e)) {
                const raw = e.dataTransfer.getData(DOCUMENT_DRAG_TYPE);
                const docId = Number(raw);
                setOverId(null);
                if (Number.isFinite(docId)) onDropDocument?.(docId, n.id);
                return;
              }
              handleFolderReorderDrop(n.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            className={
              overId === n.id && dragId !== n.id ? "rounded-md ring-2 ring-inset ring-ink/30" : undefined
            }
          >
            <FolderRow
              label={n.name}
              active={activeId === n.id}
              depth={depth}
              draggable={!!onReorder && editingId !== n.id}
              editing={editingId === n.id}
              onClick={() => onSelect(n.id)}
              onStartRename={onRename ? () => setEditingId(n.id) : undefined}
              onCommitRename={
                onRename
                  ? (name) => {
                      onRename(n, name);
                      setEditingId(null);
                    }
                  : undefined
              }
              onCancelRename={() => setEditingId(null)}
              onDelete={onDelete ? () => onDelete(n) : undefined}
            />
            {n.children.length > 0 && (
              <FolderList
                nodes={n.children}
                parentId={n.id}
                depth={depth + 1}
                activeId={activeId}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onReorder={onReorder}
                onDropDocument={onDropDocument}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FolderRow({
  label,
  active,
  depth,
  draggable,
  editing,
  onClick,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: {
  label: string;
  active: boolean;
  depth: number;
  draggable?: boolean;
  editing?: boolean;
  onClick: () => void;
  onStartRename?: () => void;
  onCommitRename?: (name: string) => void;
  onCancelRename?: () => void;
  onDelete?: () => void;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancelRename?.();
    }
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    const next = e.currentTarget.value.trim();
    if (next && next !== label) onCommitRename?.(next);
    else onCancelRename?.();
  }

  return (
    <div
      className={`group flex items-center rounded-md transition-colors ${
        active ? "bg-ink" : "hover:bg-surface"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={label}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          aria-label="폴더 이름"
          style={{ paddingLeft: 8 + depth * 14 }}
          className="min-w-0 flex-1 rounded-md bg-canvas py-1.5 pr-1 text-left text-sm text-ink outline-none ring-1 ring-inset ring-primary/50"
        />
      ) : (
        <button
          type="button"
          onClick={onClick}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={`flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-1 text-left text-sm ${
            active ? "font-medium text-white" : "text-ink-muted group-hover:text-ink"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span className="truncate">{label}</span>
        </button>
      )}
      {!editing && (onStartRename || onDelete) && (
        <span className="hidden shrink-0 items-center gap-0.5 pr-1.5 group-hover:flex">
          {onStartRename && (
            <button
              type="button"
              onClick={onStartRename}
              aria-label="이름 변경"
              className={`rounded p-1 ${
                active ? "text-white/70 hover:text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="폴더 삭제"
              className={`rounded p-1 ${
                active ? "text-white/70 hover:text-primary-soft" : "text-ink-muted hover:text-primary"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
              </svg>
            </button>
          )}
        </span>
      )}
    </div>
  );
}
