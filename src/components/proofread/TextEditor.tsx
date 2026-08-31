"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import "@toast-ui/editor/dist/toastui-editor.css";
import type EditorType from "@toast-ui/editor";

export type TextEditorHandle = {
  getMarkdown: () => string;
  getText: () => string;
  setMarkdown: (markdown: string) => void;
};

let removeChildGuardInstalled = false;
function installRemoveChildGuard() {
  if (typeof window === "undefined" || removeChildGuardInstalled) return;
  removeChildGuardInstalled = true;
  const original = Node.prototype.removeChild;
  Node.prototype.removeChild = function patchedRemoveChild<T extends Node>(
    this: Node,
    child: T,
  ): T {
    if (child.parentNode !== this) return child;
    return original.call(this, child) as T;
  };
}
installRemoveChildGuard();

export const TextEditor = forwardRef<
  TextEditorHandle,
  {
    initialValue?: string;
    placeholder?: string;
    height?: string;
  }
>(function TextEditor({ initialValue = "", placeholder, height = "420px" }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorType | null>(null);
  const [isEmpty, setIsEmpty] = useState(!initialValue.trim());
  const [overlayPos, setOverlayPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    let disposed = false;

    function measureOverlay() {
      const wrap = wrapRef.current;
      const candidates = elRef.current?.querySelectorAll<HTMLElement>(".ProseMirror") ?? [];
      const content = Array.from(candidates).find((el) => el.offsetParent !== null);
      if (!wrap || !content) return;
      const wrapRect = wrap.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const style = getComputedStyle(content);
      setOverlayPos({
        top: contentRect.top - wrapRect.top + parseFloat(style.paddingTop || "0"),
        left: contentRect.left - wrapRect.left + parseFloat(style.paddingLeft || "0"),
      });
    }

    import("@toast-ui/editor").then(({ default: Editor }) => {
      if (disposed || !elRef.current) return;
      const editor = new Editor({
        el: elRef.current,
        height,
        initialEditType: "markdown",
        previewStyle: "tab",
        initialValue,
      });
      editor.on("change", () => setIsEmpty(!editor.getMarkdown().trim()));
      editor.on("changeMode", () => requestAnimationFrame(measureOverlay));
      editorRef.current = editor;
      requestAnimationFrame(measureOverlay);
    });

    return () => {
      disposed = true;
      try {
        editorRef.current?.destroy();
      } catch {
      }
      editorRef.current = null;
    };
    // 최초 마운트 시 한 번만 초기화 — height/placeholder/initialValue 변경은 에디터 재생성 대상이 아니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getMarkdown: () => editorRef.current?.getMarkdown() ?? "",
    getText: () => {
      if (typeof document === "undefined") return "";
      const div = document.createElement("div");
      div.innerHTML = editorRef.current?.getHTML() ?? "";
      return div.textContent ?? "";
    },
    setMarkdown: (markdown: string) => {
      editorRef.current?.setMarkdown(markdown);
      setIsEmpty(!markdown.trim());
    },
  }));

  return (
    <div ref={wrapRef} className="group relative">
      <div ref={elRef} />
      {placeholder && isEmpty && overlayPos && (
        <div
          className="pointer-events-none absolute text-[13px] text-ink-muted group-has-[.toastui-editor-md-preview.active]:hidden"
          style={{ top: overlayPos.top, left: overlayPos.left }}
          aria-hidden
        >
          {placeholder}
        </div>
      )}
    </div>
  );
});
