"use client";

import { useEffect, useState } from "react";
import Canvas from "@/components/Canvas";
import HistorySidebar from "@/components/HistorySidebar";
import { getSessions, getSession, saveSession, createSession, getProjects } from "@/lib/db";
import type { Session, Project } from "@/types/session";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const [sessions, projs] = await Promise.all([getSessions(), getProjects()]);
        setProjects(projs);
        if (sessions.length > 0) setSession(sessions[0]);
      } catch (e) {
        console.error("初期化エラー:", e);
      } finally {
        setHydrated(true);
      }
    }
    init();
  }, []);

  async function handleProjectsChange() {
    const projs = await getProjects();
    setProjects(projs);
  }

  async function handleSessionUpdate(updates: Partial<Session>) {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveSession(updated);
      return updated;
    });
  }

  async function handleSessionCreate(
    updates: Partial<Session> & { id: string },
    pageUrls: string[]
  ) {
    const { id, ...rest } = updates;
    const base = await createSession(
      id,
      rest.manufacturer ?? "mitsubishi",
      rest.pdfName ?? "ladder.pdf",
      rest.projectId ?? null
    );
    const updated: Session = { ...base, ...rest, pdfPageUrls: pageUrls };
    await saveSession(updated);
    setSession(updated);
  }

  async function handleSelectSession(id: string) {
    const s = await getSession(id);
    if (s) {
      setSession(s);
      setShowHistory(false);
    }
  }

  function handleNewSession() {
    setSession(null);
    setShowHistory(false);
  }

  if (!hydrated) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-gray-800 tracking-tight">Ladder to C</h1>
          {session?.pdfName && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-sm text-gray-500 truncate max-w-xs">{session.pdfName}</span>
            </>
          )}
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl border transition-colors
            ${showHistory
              ? "bg-gray-800 text-white border-gray-800"
              : "text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          履歴
        </button>
      </header>

      {/* キャンバスエリア */}
      <div className="flex-1 relative overflow-hidden">
        <Canvas
          session={session}
          projects={projects}
          onSessionUpdate={handleSessionUpdate}
          onSessionCreate={handleSessionCreate}
          onProjectsChange={handleProjectsChange}
        />

        {showHistory && (
          <HistorySidebar
            currentId={session?.id}
            onSelect={handleSelectSession}
            onNew={handleNewSession}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  );
}
