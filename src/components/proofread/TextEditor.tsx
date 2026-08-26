"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
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
  const elRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorType | null>(null);

  useEffect(() => {
    let disposed = false;

    import("@toast-ui/editor").then(({ default: Editor }) => {
      if (disposed || !elRef.current) return;
      editorRef.current = new Editor({
        el: elRef.current,
        height,
        initialEditType: "markdown",
        previewStyle: "tab",
        placeholder,
        initialValue,
      });
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
    },
  }));

  return <div ref={elRef} />;
});
