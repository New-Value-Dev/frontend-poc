"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { errorMessage } from "@/lib/api";
import { listProjects } from "@/lib/projects";
import { ErrorBanner } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/Dropdown";
import type { Project } from "@/lib/types";

/*
 * 퀴즈 API는 전부 프로젝트 스코프(`/projects/{project_id}/quiz-questions`, `/quizzes`,
 * `/quiz-sessions`)지만 `/quiz/*` 라우트에는 프로젝트가 없다. 프로젝트를 "먼저 골라야 하는
 * 것"이 아니라 **조회 조건**으로 다룬다: 기본은 전체(참여 중인 모든 프로젝트를 병렬로
 * 조회해 합침), 하나를 고르면 그 프로젝트만.
 *
 * 선택값은 localStorage에 남겨 하위 메뉴를 오갈 때 유지된다. 문제집 상세/응시/결과는
 * 문제집 자체가 project_id를 갖고 있어 이 필터와 무관하게 동작한다.
 */

const STORAGE_KEY = "ax.quiz.projectId";
/** 전체 조회를 뜻하는 필터 값. */
export const ALL_PROJECTS = "";

type QuizProjectValue = {
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  scopeIds: number[];
  projectNames: Map<number, string>;
  loading: boolean;
  error: string | null;
};

const QuizProjectContext = createContext<QuizProjectValue | null>(null);

export function QuizProjectProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    listProjects()
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        setProjectId((current) => {
          if (current !== ALL_PROJECTS && list.some((p) => String(p.id) === current)) return current;
          const stored =
            typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
          // 저장된 프로젝트가 없어졌거나 저장된 값이 없으면 전체 조회로 시작한다.
          return stored && list.some((p) => String(p.id) === stored) ? stored : ALL_PROJECTS;
        });
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "프로젝트 목록을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const select = useCallback((id: string) => {
    setProjectId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
    }
  }, []);

  const scopeIds = useMemo(
    () => (projectId === ALL_PROJECTS ? projects.map((p) => p.id) : [Number(projectId)]),
    [projectId, projects],
  );

  const projectNames = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const value = useMemo<QuizProjectValue>(
    () => ({
      projects,
      projectId,
      setProjectId: select,
      scopeIds,
      projectNames,
      loading: authLoading || loading,
      error,
    }),
    [projects, projectId, select, scopeIds, projectNames, authLoading, loading, error],
  );

  return <QuizProjectContext.Provider value={value}>{children}</QuizProjectContext.Provider>;
}

export function useQuizProject(): QuizProjectValue {
  const value = useContext(QuizProjectContext);
  if (!value) throw new Error("useQuizProject는 QuizProjectProvider 안에서만 사용할 수 있습니다.");
  return value;
}

export function QuizProjectFilter() {
  const { projects, projectId, setProjectId } = useQuizProject();

  if (projects.length <= 1) return null;

  return (
    <Dropdown
      variant="chip"
      label="프로젝트"
      value={projectId}
      onChange={setProjectId}
      options={[
        { value: ALL_PROJECTS, label: "전체 프로젝트" },
        ...projects.map((p) => ({ value: String(p.id), label: p.name })),
      ]}
    />
  );
}

export function useProjectFilterActive(): boolean {
  const { projects, projectId } = useQuizProject();
  return projects.length > 1 && projectId !== ALL_PROJECTS;
}

export function QuizProjectGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { projects, loading, error } = useQuizProject();

  if (authLoading || loading) return null;

  if (!user) return <ErrorBanner message="퀴즈는 로그인한 사용자만 사용할 수 있습니다" needLogin />;
  if (error) return <ErrorBanner message={error} />;

  if (projects.length === 0) {
    return (
      <ErrorBanner message="참여 중인 프로젝트가 없습니다. 먼저 프로젝트를 만들거나 초대를 수락해 주세요." />
    );
  }

  return <>{children}</>;
}
