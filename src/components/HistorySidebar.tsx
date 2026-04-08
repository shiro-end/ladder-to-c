"use client";

import { useEffect, useState } from "react";
import { getSessions, deleteSession, getProjects, deleteProject, updateSessionName, updateProjectName } from "@/lib/db";
import type { Session, Project } from "@/types/session";

interface Props {
  currentId: string | undefined;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

export default function HistorySidebar({ currentId, onSelect, onNew, onClose }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(["__unclassified__"]));

  async function reload() {
    const [sess, projs] = await Promise.all([getSessions(), getProjects()]);
    setSessions(sess);
    setProjects(projs);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDeleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await deleteSession(id);
    reload();
  }

  async function handleDeleteProject(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("プロジェクトを削除しますか？セッションは未分類に移動されます。")) return;
    await deleteProject(id);
    reload();
  }

  async function handleRename(id: string, name: string) {
    await updateSessionName(id, name);
    reload();
  }

  async function handleRenameProject(id: string, name: string) {
    await updateProjectName(id, name);
    reload();
  }

  function toggleProject(id: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const unclassified = sessions.filter((s) => !s.projectId);

  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-72 z-30 bg-white border-l border-gray-200
        shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <span className="font-semibold text-gray-800">プロジェクト / 履歴</span>
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
        {projects.length === 0 && sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">履歴がありません</p>
        ) : (
          <>
            {/* プロジェクト別セクション */}
            {projects.map((project) => {
              const projectSessions = sessions.filter((s) => s.projectId === project.id);
              const isExpanded = expandedProjects.has(project.id);
              return (
                <div key={project.id}>
                  <ProjectRow
                    project={project}
                    sessionCount={projectSessions.length}
                    isExpanded={isExpanded}
                    onToggle={() => toggleProject(project.id)}
                    onDelete={(e) => handleDeleteProject(e, project.id)}
                    onRename={(name) => handleRenameProject(project.id, name)}
                  />
                  {isExpanded && (
                    <div className="pl-5">
                      {projectSessions.length === 0 ? (
                        <p className="text-xs text-gray-300 px-4 py-2">セッションなし</p>
                      ) : (
                        projectSessions.map((s) => (
                          <SessionRow
                            key={s.id}
                            session={s}
                            isActive={s.id === currentId}
                            onSelect={() => { onSelect(s.id); }}
                            onDelete={(e) => handleDeleteSession(e, s.id)}
                            onRename={(name) => handleRename(s.id, name)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 未分類セクション */}
            {unclassified.length > 0 && (
              <div>
                <button
                  onClick={() => toggleProject("__unclassified__")}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  <svg
                    className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${expandedProjects.has("__unclassified__") ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    未分類 ({unclassified.length})
                  </span>
                </button>
                {expandedProjects.has("__unclassified__") && (
                  unclassified.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      isActive={s.id === currentId}
                      onSelect={() => { onSelect(s.id); }}
                      onDelete={(e) => handleDeleteSession(e, s.id)}
                      onRename={(name) => handleRename(s.id, name)}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  sessionCount,
  isExpanded,
  onToggle,
  onDelete,
  onRename,
}: {
  project: Project;
  sessionCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditName(project.name);
    setEditing(true);
  }

  function commitEdit() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) onRename(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs
            focus:outline-none focus:border-blue-500"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center group">
      <button
        onClick={onToggle}
        className="flex-1 flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors min-w-0"
      >
        <svg
          className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-medium text-gray-700 truncate">📁 {project.name}</span>
        <span className="text-xs text-gray-400 flex-shrink-0">({sessionCount})</span>
      </button>
      <div className="flex items-center gap-0.5 pr-3 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
        <button
          onClick={startEdit}
          className="text-gray-300 hover:text-blue-400 p-0.5 rounded"
          title="名前を編集"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-400 p-0.5 rounded"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SessionRow({
  session: s,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(s.name ?? s.pdfName ?? "無題");

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditName(s.name ?? s.pdfName ?? "無題");
    setEditing(true);
  }

  function commitEdit() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== (s.name ?? s.pdfName ?? "無題")) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs
            focus:outline-none focus:border-blue-500"
        />
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors group
        ${isActive ? "bg-blue-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate
            ${isActive ? "text-blue-700" : "text-gray-800"}`}>
            {s.name ?? s.pdfName ?? "無題"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {s.manufacturer === "keyence" ? "キーエンス" : "三菱電機"}
            {" · "}Step {s.activeStep}
            {" · "}{new Date(s.updatedAt).toLocaleDateString("ja-JP")}
          </p>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5">
          <button
            onClick={startEdit}
            className="text-gray-300 hover:text-blue-400 p-0.5 rounded"
            title="名前を編集"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="text-gray-300 hover:text-red-400 p-0.5 rounded"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </button>
  );
}
