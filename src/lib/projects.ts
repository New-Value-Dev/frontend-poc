import { api } from "./api";
import type { Project, Folder } from "./types";

export function listProjects() {
  return api.get<Project[]>("/projects");
}

export function getProject(projectId: string) {
  return api.get<Project>(`/projects/${projectId}`);
}

export function createProject(input: { name: string; description?: string }) {
  return api.post<Project>("/projects", input);
}

export function updateProject(projectId: string, input: Partial<{ name: string; description: string }>) {
  return api.patch<Project>(`/projects/${projectId}`, input);
}

export function deleteProject(projectId: string) {
  return api.delete<void>(`/projects/${projectId}`);
}

/* --- 폴더 --- */
export function listFolders(projectId: string) {
  return api.get<Folder[]>(`/projects/${projectId}/folders`);
}

export function createFolder(projectId: string, input: { name: string; parent_id?: number }) {
  return api.post<Folder>(`/projects/${projectId}/folders`, input);
}

export function updateFolder(folderId: string, input: { name: string }) {
  return api.patch<Folder>(`/folders/${folderId}`, input);
}

export function deleteFolder(folderId: string) {
  return api.delete<void>(`/folders/${folderId}`);
}
