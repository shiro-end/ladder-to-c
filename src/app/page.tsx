"use client";

import { useEffect, useState } from "react";
import Canvas from "@/components/Canvas";
import HistorySidebar from "@/components/HistorySidebar";
import {
  getSessions,
  getSession,
  saveSession,
  createSession,
  savePdfPages,
  getPdfPages,
} from "@/lib/session-storage";
import type { Session } from "@/types/session";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const sessions = getSessions();
    if (sessions.length > 0) {
      setSession(sessions[0]);
      setPdfPages(getPdfPages(sessions[0].id));
    }
  }, []);

  function handleSessionUpdate(updates: Partial<Session>) {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveSession(updated);
      return updated;
    });
  }

  function handleSessionCreate(updates: Partial<Session>, pages: string[]) {
    setSession((prev) => {
      // 既存セッションがある場合は更新、なければ新規作成
      const base =
        prev ??
        createSession(
          updates.manufacturer ?? "mitsubishi",
          updates.pdfName ?? "ladder.pdf"
        );
      const updated = { ...base, ...updates };
      saveSession(updated);
      savePdfPages(updated.id, pages);
      setPdfPages(pages);
      return updated;
    });
  }

  function handleSelectSession(id: string) {
    const s = getSession(id);
    if (s) {
      setSession(s);
      setPdfPages(getPdfPages(s.id));
      setShowHistory(false);
    }
  }

  function handleNewSession() {
    setSession(null);
    setPdfPages([]);
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
          pdfPages={pdfPages}
          onSessionUpdate={handleSessionUpdate}
          onSessionCreate={handleSessionCreate}
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
