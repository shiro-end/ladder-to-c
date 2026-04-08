"use client";

import type { Session, Manufacturer, Project } from "@/types/session";

const SESSIONS_KEY = "ladder_sessions";
const PROJECTS_KEY = "ladder_projects";
const PAGES_PREFIX = "ladder_pages_";

/* ── Sessions ── */

export function getSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Session[]).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function getSession(id: string): Session | null {
  return getSessions().find((s) => s.id === id) ?? null;
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  const sessions = getSessions().filter((s) => s.id !== session.id);
  sessions.unshift({ ...session, updatedAt: new Date().toISOString() });
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  const sessions = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  try { sessionStorage.removeItem(PAGES_PREFIX + id); } catch { /* ignore */ }
}

export function createSession(
  manufacturer: Manufacturer,
  pdfName: string,
  projectId: string | null = null
): Session {
  const id = crypto.randomUUID();
  const session: Session = {
    id,
    name: `${pdfName} — ${new Date().toLocaleDateString("ja-JP")}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectId,
    activeStep: 1,
    manufacturer,
    pdfName,
    pageCount: 0,
    rungs: null,
    clarifications: null,
    conversionTable: null,
    cCode: null,
    interpretationDoc: null,
    pdfPageUrls: null,
  };
  saveSession(session);
  return session;
}

/* ── Projects ── */

export function getProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Project[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export function saveProject(project: Project): void {
  if (typeof window === "undefined") return;
  const projects = getProjects().filter((p) => p.id !== project.id);
  projects.unshift(project);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function createProject(name: string): Project {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  };
  saveProject(project);
  return project;
}

export function deleteProject(id: string): void {
  if (typeof window === "undefined") return;
  const projects = getProjects().filter((p) => p.id !== id);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  // プロジェクトに属するセッションを未分類に移動
  const sessions = getSessions().map((s) =>
    s.projectId === id ? { ...s, projectId: null } : s
  );
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function moveSessionToProject(sessionId: string, projectId: string | null): void {
  const session = getSession(sessionId);
  if (session) saveSession({ ...session, projectId });
}

/* ── PDF pages (sessionStorage) ── */

export function savePdfPages(sessionId: string, pages: string[]): void {
  try {
    sessionStorage.setItem(PAGES_PREFIX + sessionId, JSON.stringify(pages));
  } catch { /* ストレージ容量不足は無視 */ }
}

export function getPdfPages(sessionId: string): string[] {
  try {
    const raw = sessionStorage.getItem(PAGES_PREFIX + sessionId);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
