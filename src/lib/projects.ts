import { api } from "./api";
import type {
  Project,
  Folder,
  ProjectInvitation,
  ProjectMember,
  Visibility,
} from "./types";

export function listProjects() {
  return api.get<Project[]>("/projects");
}

export function getProject(projectId: string) {
  return api.get<Project>(`/projects/${projectId}`);
}

export function createProject(input: { name: string; description?: string; visibility?: Visibility }) {
  return api.post<Project>("/projects", input);
}

export function updateProject(projectId: string, input: Partial<{ name: string; description: string }>) {
  return api.patch<Project>(`/projects/${projectId}`, input);
}

export function updateProjectVisibility(projectId: string, visibility: Visibility) {
  return api.patch<Project>(`/projects/${projectId}/visibility`, { visibility });
}

export function deleteProject(projectId: string) {
  return api.delete<void>(`/projects/${projectId}`);
}

export function listProjectMembers(projectId: string) {
  return api.get<ProjectMember[]>(`/projects/${projectId}/members`);
}

export function inviteProjectMember(
  projectId: string,
  invitee: { user_id: number } | { email: string },
) {
  return api.post<ProjectMember>(`/projects/${projectId}/members`, invitee);
}

export function removeProjectMember(projectId: string, userId: number) {
  return api.delete<void>(`/projects/${projectId}/members/${userId}`);
}

export function listMyInvitations() {
  return api.get<ProjectInvitation[]>("/projects/invitations");
}

export function acceptProjectInvitation(projectId: string) {
  return api.post<Project>(`/projects/${projectId}/invitation/accept`);
}

export function declineProjectInvitation(projectId: string) {
  return api.post<void>(`/projects/${projectId}/invitation/decline`);
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

export function reorderFolder(
  folderId: string,
  input: { parent_id?: number | null; target_index: number },
) {
  return api.patch<Folder[]>(`/folders/${folderId}/reorder`, input);
}
