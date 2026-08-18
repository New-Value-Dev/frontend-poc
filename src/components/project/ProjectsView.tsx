"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { listProjects, createProject, deleteProject } from "@/lib/projects";
import { errorMessage, isAuthError } from "@/lib/api";
import type { Project } from "@/lib/types";
import { PageHeader, Card, Button, ErrorBanner, Field, Input } from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useAuth } from "@/components/auth/AuthProvider";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setNeedLogin(false);
    try {
      setProjects(await listProjects());
    } catch (e) {
      setError(errorMessage(e, "프로젝트를 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  const { loading: authLoading } = useAuth();

  // 인증 세션(access token) 확인 후에 fetch해서, 새로고침 시 토큰 갱신과 경합해
  // "로그인 필요"가 잘못 깜빡이지 않게 한다.
  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading]);

  function openForm() {
    setName("");
    setDescription("");
    setFormError(null);
    setShowForm(true);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setProjects((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (e) {
      setFormError(errorMessage(e, "프로젝트 생성에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    try {
      await deleteProject(String(target.id));
      setProjects((p) => p.filter((x) => x.id !== target.id));
      setDeleteTarget(null);
    } catch (e) {
      setError(errorMessage(e, "삭제에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="프로젝트"
        description="프로젝트별로 폴더와 문서를 구성하고 AI 기능을 적용합니다."
        actions={<Button onClick={openForm}>새 프로젝트</Button>}
      />

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      {loading ? (
        <Card className="grid place-items-center py-16 text-sm text-ink-muted">불러오는 중…</Card>
      ) : projects.length === 0 && !error ? (
        <Card className="grid place-items-center gap-1 py-16 text-center">
          <p className="text-sm font-medium text-ink">아직 프로젝트가 없습니다.</p>
          <p className="text-xs text-ink-muted">＋ 새 프로젝트로 시작하세요.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-col p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-base font-semibold text-ink hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {p.description || "설명 없음"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-surface hover:text-primary"
                >
                  삭제
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-ink-muted">
                <span>생성 {fmtDate(p.created_at)}</span>
                <Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                  열기 →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="새 프로젝트"
        className="max-w-md"
      >
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <Field label="프로젝트 이름" htmlFor="project-name">
            <Input
              id="project-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2026 상반기 사업계획"
            />
          </Field>
          <Field label="설명" htmlFor="project-description" hint="선택 항목입니다.">
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 프로젝트가 다루는 문서를 한 줄로"
            />
          </Field>
          {formError && <ErrorBanner message={formError} needLogin={needLogin} />}
          <div className="mt-1 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              취소
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "생성 중…" : "생성"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="프로젝트 삭제"
        message={`"${deleteTarget?.name}" 프로젝트를 삭제할까요? 되돌릴 수 없습니다.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />
    </div>
  );
}
