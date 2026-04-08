"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import StepCard from "@/components/StepCard";
import type { Session, Manufacturer, Rung, ClarificationQuestion, Project } from "@/types/session";
import { createProject } from "@/lib/db";

const BATCH_SIZE = 5;

const MODELS = [
  { id: "claude-opus-4-6",   label: "Claude Opus 4",   provider: "Anthropic" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4",  provider: "Anthropic" },
  { id: "gpt-4o",            label: "GPT-4o",           provider: "OpenAI" },
  { id: "gpt-4o-mini",       label: "GPT-4o mini",      provider: "OpenAI" },
] as const;

type ModelId = typeof MODELS[number]["id"];

interface Props {
  session: Session | null;
  projects: Project[];
  isFocused: boolean;
  onToggleFocus: () => void;
  onComplete: (updates: Partial<Session> & { id: string }, pageUrls: string[]) => void;
  onProjectsChange: () => void;
}

interface Progress {
  phase: "parsing" | "interpreting";
  current: number;
  total: number;
  pageStart: number;
  pageEnd: number;
}

export default function Step1Upload({
  session, projects, isFocused, onToggleFocus, onComplete, onProjectsChange,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [manufacturer, setManufacturer] = useState<Manufacturer>(session?.manufacturer ?? "keyence");
  const [model, setModel] = useState<ModelId>("claude-opus-4-6");
  const [projectId, setProjectId] = useState<string | null>(session?.projectId ?? null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isComplete = session !== null && session.activeStep > 1;

  function selectFile(f: File) {
    if (f.type !== "application/pdf") { setError("PDFファイルを選択してください"); return; }
    setFile(f);
    setError("");
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    const p = await createProject(newProjectName.trim());
    setProjectId(p.id);
    setNewProjectName("");
    setShowNewProject(false);
    onProjectsChange();
  }

  async function handleStart() {
    if (!file) return;
    setError("");

    const sessionId = crypto.randomUUID();

    setProgress({ phase: "parsing", current: 0, total: 1, pageStart: 1, pageEnd: 1 });
    let allPages: string[] = [];
    let pageUrls: string[] = [];
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sessionId", sessionId);
      const res = await fetch("/api/parse-pdf", { method: "POST", body: form });
      const data = await res.json() as { pages?: string[]; pageUrls?: string[]; pageCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "PDF解析失敗");
      allPages = data.pages ?? [];
      pageUrls = data.pageUrls ?? [];
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF解析エラー");
      setProgress(null);
      return;
    }

    const pageCount = allPages.length;
    const totalBatches = Math.ceil(pageCount / BATCH_SIZE);

    let accRungs: Rung[] = [];
    let accClarifications: ClarificationQuestion[] = [];

    for (let batch = 0; batch < totalBatches; batch++) {
      const pageStart = batch * BATCH_SIZE + 1;
      const pageEnd = Math.min(pageStart + BATCH_SIZE - 1, pageCount);
      const batchPages = allPages.slice(batch * BATCH_SIZE, batch * BATCH_SIZE + BATCH_SIZE);

      setProgress({ phase: "interpreting", current: batch + 1, total: totalBatches, pageStart, pageEnd });

      try {
        const res = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages: batchPages,
            previousRungs: accRungs,
            manufacturer,
            model,
            batchInfo: { current: batch + 1, total: totalBatches, pageStart, pageEnd },
          }),
        });
        const data = await res.json() as { rungs?: Rung[]; clarifications?: ClarificationQuestion[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? `バッチ${batch + 1}の解析失敗`);
        accRungs = [...accRungs, ...(data.rungs ?? [])];
        for (const q of data.clarifications ?? []) {
          const isDup = accClarifications.some(
            (c) => c.question.trim().slice(0, 20) === q.question.trim().slice(0, 20)
          );
          if (!isDup) accClarifications.push(q);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : `バッチ${batch + 1}でエラー`);
        setProgress(null);
        return;
      }
    }

    const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model;
    const sessionName = `${file.name} — ${modelLabel} — ${new Date().toLocaleDateString("ja-JP")}`;

    setProgress(null);
    onComplete(
      {
        id: sessionId,
        name: sessionName,
        projectId,
        manufacturer,
        pdfName: file.name,
        pageCount,
        rungs: accRungs,
        clarifications: accClarifications,
        activeStep: 2,
        pdfPageUrls: pageUrls,
      },
      pageUrls
    );
  }

  const isRunning = progress !== null;

  return (
    <StepCard
      step={1}
      title="PDF取り込み"
      status={isComplete ? "complete" : "active"}
      width="w-72"
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      collapsedSummary={
        <p className="text-xs">
          {session?.pdfName} / {session?.manufacturer === "keyence" ? "キーエンス" : "三菱電機"} / {session?.pageCount}p
        </p>
      }
    >
      <div className="p-4 space-y-4">
        {isComplete ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700 break-all">{session?.pdfName}</p>
            <p className="text-xs text-gray-500">
              {session?.manufacturer === "keyence" ? "キーエンス" : "三菱電機"} / {session?.pageCount} ページ
            </p>
            {session?.projectId && (
              <p className="text-xs text-blue-600">
                📁 {projects.find((p) => p.id === session.projectId)?.name ?? "プロジェクト"}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* メーカー選択 */}
            <div className="flex gap-4">
              {(["mitsubishi", "keyence"] as Manufacturer[]).map((m) => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="manufacturer" value={m}
                    checked={manufacturer === m} onChange={() => setManufacturer(m)}
                    className="accent-blue-600" />
                  <span className="text-sm text-gray-700">
                    {m === "mitsubishi" ? "三菱電機" : "キーエンス"}
                  </span>
                </label>
              ))}
            </div>

            {/* モデル選択 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">モデルを選ぶ</label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {MODELS.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="model" value={m.id}
                      checked={model === m.id} onChange={() => setModel(m.id)}
                      className="accent-blue-600" />
                    <span className="text-sm text-gray-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* プロジェクト選択 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">プロジェクト</label>
              <select
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm
                  focus:outline-none focus:border-blue-400 text-gray-700"
              >
                <option value="">-- 未分類 --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {showNewProject ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); if (e.key === "Escape") setShowNewProject(false); }}
                    placeholder="プロジェクト名"
                    className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-xs
                      focus:outline-none focus:border-blue-500"
                  />
                  <button onClick={handleCreateProject}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    作成
                  </button>
                  <button onClick={() => setShowNewProject(false)}
                    className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded-lg">
                    ×
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowNewProject(true)}
                  className="text-xs text-blue-600 hover:text-blue-800">
                  ＋ 新規プロジェクト
                </button>
              )}
            </div>

            {/* ドロップゾーン */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !isRunning && inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0]; if (f) selectFile(f);
                }} />
              {file ? (
                <p className="text-sm font-medium text-gray-800 break-all">{file.name}</p>
              ) : (
                <p className="text-sm text-gray-400">PDFをドロップ or クリック</p>
              )}
            </div>

            {/* 進捗表示 */}
            {isRunning && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  {progress.phase === "parsing" ? (
                    <span>PDFを解析中...</span>
                  ) : (
                    <span>
                      p.{progress.pageStart}〜{progress.pageEnd} を解析中
                      （{progress.current} / {progress.total} バッチ）
                    </span>
                  )}
                  <span className="tabular-nums text-gray-400">
                    {progress.phase === "interpreting"
                      ? `${Math.round((progress.current / progress.total) * 100)}%`
                      : ""}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: progress.phase === "parsing"
                        ? "5%"
                        : `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleStart}
              disabled={!file || isRunning}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? "解析中..." : "ラダー図を解釈 →"}
            </button>
          </>
        )}
      </div>
    </StepCard>
  );
}
