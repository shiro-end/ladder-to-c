"use client";

import type { Session, Manufacturer } from "@/types/session";

const SESSIONS_KEY = "ladder_sessions";
const PAGES_PREFIX = "ladder_pages_";

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

export function createSession(manufacturer: Manufacturer, pdfName: string): Session {
  const id = crypto.randomUUID();
  const session: Session = {
    id,
    name: `${pdfName} — ${new Date().toLocaleDateString("ja-JP")}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeStep: 1,
    manufacturer,
    pdfName,
    pageCount: 0,
    rungs: null,
    clarifications: null,
    conversionTable: null,
    cCode: null,
    interpretationDoc: null,
  };
  saveSession(session);
  return session;
}

/** PDF ページ画像 (base64) をセッションストレージに保存 */
export function savePdfPages(sessionId: string, pages: string[]): void {
  try {
    sessionStorage.setItem(PAGES_PREFIX + sessionId, JSON.stringify(pages));
  } catch {
    // ストレージ容量不足の場合は無視（プレビュー不可になるだけ）
  }
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
