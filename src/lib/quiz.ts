import { api, ApiError } from "./api";
import type {
  QuizAnswerGradeResult,
  QuizBook,
  QuizBookCreate,
  QuizBookUpdate,
  QuizDifficulty,
  QuizGenerateRequest,
  QuizGenerationJob,
  QuizQuestion,
  QuizQuestionCreate,
  QuizQuestionType,
  QuizQuestionUpdate,
  QuizReviewStatus,
  QuizSession,
  QuizSessionMode,
  QuizSessionResult,
  QuizSessionStartResponse,
} from "./types";

/* 백엔드 app/api/v1/quiz.py 반영. */

export function isQuizLockedError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409;
}

export const QUIZ_LOCKED_MESSAGE =
  "응시 이력이 있어 수정할 수 없습니다. 복제한 뒤 편집해 주세요.";

/* --- 문제은행 --- */

export function listQuestions(
  projectId: string | number,
  filters?: {
    document_id?: number;
    difficulty?: QuizDifficulty;
    type?: QuizQuestionType;
    review_status?: QuizReviewStatus;
    q?: string;
  },
) {
  const params = new URLSearchParams();
  if (filters?.document_id != null) params.set("document_id", String(filters.document_id));
  if (filters?.difficulty) params.set("difficulty", filters.difficulty);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.review_status) params.set("review_status", filters.review_status);
  if (filters?.q) params.set("q", filters.q);
  const query = params.toString();
  return api.get<QuizQuestion[]>(
    `/projects/${projectId}/quiz-questions${query ? `?${query}` : ""}`,
  );
}

/** 서버가 generation_type=MANUAL, review_status=DRAFT를 붙인다 (201). */
export function createQuestion(projectId: string | number, input: QuizQuestionCreate) {
  return api.post<QuizQuestion>(`/projects/${projectId}/quiz-questions`, input);
}

export function updateQuestion(questionId: number, input: QuizQuestionUpdate) {
  return api.patch<QuizQuestion>(`/quiz-questions/${questionId}`, input);
}

/**
 * 문제은행에서 완전 삭제
 */
export function deleteQuestion(questionId: number) {
  return api.delete<void>(`/quiz-questions/${questionId}`);
}

/* --- AI 문제 생성 --- */

export function generateQuestions(projectId: string | number, input: QuizGenerateRequest) {
  return api.post<QuizGenerationJob>(`/projects/${projectId}/quiz-questions/generate`, input);
}

export function getGenerationJob(jobId: string | number) {
  return api.get<QuizGenerationJob>(`/quiz-generation-jobs/${jobId}`);
}

/* --- 문제집 --- */

export function listBooks(projectId: string | number) {
  return api.get<QuizBook[]>(`/projects/${projectId}/quizzes`);
}

export function createBook(projectId: string | number, input: QuizBookCreate) {
  return api.post<QuizBook>(`/projects/${projectId}/quizzes`, input);
}

export function getBook(quizBookId: string | number) {
  return api.get<QuizBook>(`/quizzes/${quizBookId}`);
}

export function updateBook(quizBookId: string | number, input: QuizBookUpdate) {
  return api.patch<QuizBook>(`/quizzes/${quizBookId}`, input);
}

export function deleteBook(quizBookId: string | number) {
  return api.delete<void>(`/quizzes/${quizBookId}`);
}

export function duplicateBook(quizBookId: string | number) {
  return api.post<QuizBook>(`/quizzes/${quizBookId}/duplicate`);
}

export function listBookQuestions(quizBookId: string | number) {
  return api.get<QuizQuestion[]>(`/quizzes/${quizBookId}/questions`);
}

export function addBookQuestions(quizBookId: string | number, questionIds: number[]) {
  return api.post<QuizQuestion[]>(`/quizzes/${quizBookId}/questions`, {
    question_ids: questionIds,
  });
}

export function removeBookQuestion(quizBookId: string | number, questionId: number) {
  return api.delete<void>(`/quizzes/${quizBookId}/questions/${questionId}`);
}

/* --- 응시 --- */

export function startSession(quizBookId: string | number, mode: QuizSessionMode) {
  return api.post<QuizSessionStartResponse>(`/quizzes/${quizBookId}/sessions`, { mode });
}

export function gradeAnswer(
  quizBookId: string | number,
  sessionId: number,
  input: { question_id: number; user_answer: string },
) {
  return api.post<QuizAnswerGradeResult>(
    `/quizzes/${quizBookId}/sessions/${sessionId}/answers`,
    input,
  );
}

/** 최종 제출 → 점수 집계 + 오답노트 ,재제출은 409 */
export function submitSession(
  quizBookId: string | number,
  sessionId: number,
  answers: { question_id: number; user_answer: string }[],
) {
  return api.post<QuizSessionResult>(
    `/quizzes/${quizBookId}/sessions/${sessionId}/submit`,
    { answers },
  );
}

export function listBookSessions(quizBookId: string | number) {
  return api.get<QuizSession[]>(`/quizzes/${quizBookId}/sessions`);
}

export function getSession(quizBookId: string | number, sessionId: string | number) {
  return api.get<QuizSessionResult>(`/quizzes/${quizBookId}/sessions/${sessionId}`);
}

export function listMySessions(projectId: string | number) {
  return api.get<QuizSession[]>(`/projects/${projectId}/quiz-sessions`);
}
