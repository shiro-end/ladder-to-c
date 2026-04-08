"use client";

import { useEffect, useState } from "react";
import { getSessions, deleteSession } from "@/lib/session-storage";
import type { Session } from "@/types/session";

interface Props {
  currentId: string | undefined;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

function groupByDate(sessions: Session[]) {
  const today = new Date().toLocaleDateString("ja-JP");
  const groups: Record<string, Session[]> = {};
  for (const s of sessions) {
    const d = new Date(s.createdAt).toLocaleDateString("ja-JP");
    const label = d === today ? "今日" : d;
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  }
  return groups;
}

export default function HistorySidebar({ currentId, onSelect, onNew, onClose }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteSession(id);
    setSessions(getSessions());
  }

  const groups = groupByDate(sessions);

  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-72 z-30 bg-white border-l border-gray-200
        shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <span className="font-semibold text-gray-800">変換履歴</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 新規ボタン */}
      <div className="px-4 py-3 border-b border-gray-100">
        <button
          onClick={onNew}
          className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl
            hover:bg-blue-700 transition-colors"
        >
          + 新規変換
        </button>
      </div>

      {/* セッション一覧 */}
      <div className="flex-1 overflow-y-auto py-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">履歴がありません</p>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2">
                {label}
              </p>
              {items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors group
                    ${s.id === currentId ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate
                        ${s.id === currentId ? "text-blue-700" : "text-gray-800"}`}>
                        {s.pdfName ?? "無題"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.manufacturer === "keyence" ? "キーエンス" : "三菱電機"}
                        {" · "}Step {s.activeStep}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, s.id)}
                      className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100
                        transition-all flex-shrink-0 mt-0.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
