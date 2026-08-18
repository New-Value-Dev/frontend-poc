import type { Folder } from "@/lib/types";

type FolderNode = Folder & { children: FolderNode[] };

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
    ns.sort((a, b) => a.name.localeCompare(b.name, "ko"));
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

export function FolderTree({
  folders,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  folders: Folder[];
  activeId: number | null;
  onSelect: (id: number | null) => void;
  onNew: () => void;
  onRename?: (f: Folder) => void;
  onDelete?: (f: Folder) => void;
}) {
  const tree = buildTree(folders);
  return (
    <div className="rounded-xl border border-border bg-canvas p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-ink-muted">폴더</span>
        <button type="button" onClick={onNew} className="text-sm text-primary hover:underline" aria-label="새 폴더">
          ＋
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        <li>
          <FolderRow label="전체" active={activeId == null} depth={0} onClick={() => onSelect(null)} />
        </li>
        {tree.map((n) => (
          <FolderBranch
            key={n.id}
            node={n}
            depth={0}
            activeId={activeId}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

function FolderBranch({
  node,
  depth,
  activeId,
  onSelect,
  onRename,
  onDelete,
}: {
  node: FolderNode;
  depth: number;
  activeId: number | null;
  onSelect: (id: number | null) => void;
  onRename?: (f: Folder) => void;
  onDelete?: (f: Folder) => void;
}) {
  return (
    <li>
      <FolderRow
        label={node.name}
        active={activeId === node.id}
        depth={depth}
        onClick={() => onSelect(node.id)}
        onRename={onRename ? () => onRename(node) : undefined}
        onDelete={onDelete ? () => onDelete(node) : undefined}
      />
      {node.children.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((c) => (
            <FolderBranch
              key={c.id}
              node={c}
              depth={depth + 1}
              activeId={activeId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function FolderRow({
  label,
  active,
  depth,
  onClick,
  onRename,
  onDelete,
}: {
  label: string;
  active: boolean;
  depth: number;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`group flex items-center rounded-md transition-colors ${
        active ? "bg-primary-soft" : "hover:bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-1 text-left text-sm ${
          active ? "font-medium text-primary" : "text-ink-muted group-hover:text-ink"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        <span className="truncate">{label}</span>
      </button>
      {(onRename || onDelete) && (
        <span className="hidden shrink-0 items-center gap-0.5 pr-1.5 group-hover:flex">
          {onRename && (
            <button
              type="button"
              onClick={onRename}
              aria-label="이름 변경"
              className="rounded p-1 text-ink-muted hover:text-ink"
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
              className="rounded p-1 text-ink-muted hover:text-primary"
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
