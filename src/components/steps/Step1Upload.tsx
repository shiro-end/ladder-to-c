"use client";

import { useState, useRef, useEffect, ChangeEvent, DragEvent } from "react";
import StepCard from "@/components/StepCard";
import type { Session, Manufacturer, Rung, ClarificationQuestion, Project } from "@/types/session";
import { MODELS, type ModelId } from "@/lib/models";
import { createProject } from "@/lib/db";

const BATCH_SIZE = 5;
type BatchStatus = "pending" | "running" | "done" | "error";

interface Batch {
  index: number;
  pageStart: number;
  pageEnd: number;
  status: BatchStatus;
  errorMsg?: string;
  countdown?: number;
}

interface Props {
  session: Session | null;
  projects: Project[];
  isFocused: boolean;
  onToggleFocus: () => void;
  onComplete: (updates: Partial<Session> & { id: string }, pageUrls: string[]) => void;
  onSessionUpdate: (updates: Partial<Session>) => void;
  onProjectsChange: () => void;
  onEdit?: () => void;
}

function buildBatches(pageCount: number, existingRungs: Rung[]): Batch[] {
  const total = Math.ceil(pageCount / BATCH_SIZE);
  return Array.from({ length: total }, (_, i) => {
    const pageStart = i * BATCH_SIZE + 1;
    const pageEnd = Math.min(pageStart + BATCH_SIZE - 1, pageCount);
    const isDone = existingRungs.some(
      (r) => r.pageNumber >= pageStart && r.pageNumber <= pageEnd
    );
    return { index: i, pageStart, pageEnd, status: isDone ? "done" : "pending" } as Batch;
  });
}

function parseRetryAfter(msg: string): number {
  const m = msg.match(/try again in ([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1])) + 1 : 62;
}

async function fetchPageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Step1Upload({
  session, projects, isFocused, onToggleFocus, onComplete, onSessionUpdate, onProjectsChange, onEdit,
}: Props) {
  // Upload phase
  const [file, setFile] = useState<File | null>(null);
  const [manufacturer, setManufacturer] = useState<Manufacturer>(session?.manufacturer ?? "keyence");
  const [model, setModel] = useState<ModelId>("claude-opus-4-6");
  const [projectId, setProjectId] = useState<string | null>(session?.projectId ?? null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Batch phase
  const [phase, setPhase] = useState<"upload" | "batch">("upload");
  const [parsedPages, setParsedPages] = useState<string[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [accRungs, setAccRungs] = useState<Rung[]>([]);
  const [accClarifications, setAccClarifications] = useState<ClarificationQuestion[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  // Track which session we initialized for (to avoid re-init on fresh upload)
  const freshUploadSessionId = useRef<string | null>(null);

  const isComplete = session !== null && session.activeStep > 1;

  // Initialize batch phase when loading an existing partial session
  useEffect(() => {
    if (!session) return;
    if (session.id === freshUploadSessionId.current) return; // fresh upload, already set
    if (session.activeStep === 1 && (session.pageCount ?? 0) > 0) {
      setBatches(buildBatches(session.pageCount, session.rungs ?? []));
      setAccRungs(session.rungs ?? []);
      setAccClarifications(session.clarifications ?? []);
      setParsedPages(null);
      setPhase("batch");
    } else if (session.activeStep > 1) {
      setPhase("upload");
    }
  }, [session?.id, session?.activeStep]);

  function updateBatch(index: number, updates: Partial<Batch>) {
    setBatches((prev) => prev.map((b, i) => (i === index ? { ...b, ...updates } : b)));
  }

  async function getPages(batchIndex: number, pageCount: number): Promise<string[]> {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, pageCount);
    if (parsedPages) return parsedPages.slice(start, end);
    const urls = (session?.pdfPageUrls ?? []).slice(start, end);
    return Promise.all(urls.map(fetchPageAsBase64));
  }

  async function processBatch(
    batchIndex: number,
    currentRungs: Rung[],
    currentClarifications: ClarificationQuestion[],
    pageCount: number,
    totalBatches: number,
    batch: Batch,
  ): Promise<{ success: boolean; rungs: Rung[]; clarifications: ClarificationQuestion[] }> {
    updateBatch(batchIndex, { status: "running", errorMsg: undefined, countdown: undefined });

    let pages: string[];
    try {
      pages = await getPages(batchIndex, pageCount);
    } catch {
      updateBatch(batchIndex, { status: "error", errorMsg: "ページ取得エラー" });
      return { success: false, rungs: currentRungs, clarifications: currentClarifications };
    }

    let retries = 0;
    while (true) {
      try {
        const res = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages,
            previousRungs: currentRungs,
            manufacturer,
            model,
            batchInfo: {
              current: batchIndex + 1,
              total: totalBatches,
              pageStart: batch.pageStart,
              pageEnd: batch.pageEnd,
            },
          }),
        });
        const data = await res.json() as {
          rungs?: Rung[];
          clarifications?: ClarificationQuestion[];
          error?: string;
        };

        if (res.status === 429) {
          if (retries >= 5) {
            updateBatch(batchIndex, { status: "error", errorMsg: "レート制限超過" });
            return { success: false, rungs: currentRungs, clarifications: currentClarifications };
          }
          retries++;
          const waitSec = parseRetryAfter(data.error ?? "");
          for (let i = waitSec; i > 0; i--) {
            updateBatch(batchIndex, { status: "running", countdown: i });
            await new Promise((r) => setTimeout(r, 1000));
          }
          updateBatch(batchIndex, { countdown: undefined });
          continue;
        }

        if (!res.ok) {
          updateBatch(batchIndex, { status: "error", errorMsg: data.error ?? "エラー" });
          return { success: false, rungs: currentRungs, clarifications: currentClarifications };
        }

        const newRungs = [...currentRungs, ...(data.rungs ?? [])];
        const newClarifications = [...currentClarifications];
        for (const q of data.clarifications ?? []) {
          const isDup = newClarifications.some(
            (c) => c.question.trim().slice(0, 20) === q.question.trim().slice(0, 20)
          );
          if (!isDup) newClarifications.push(q);
        }

        setAccRungs(newRungs);
        setAccClarifications(newClarifications);
        updateBatch(batchIndex, { status: "done", errorMsg: undefined, countdown: undefined });
        onSessionUpdate({ rungs: newRungs, clarifications: newClarifications });

        return { success: true, rungs: newRungs, clarifications: newClarifications };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "エラー";
        updateBatch(batchIndex, { status: "error", errorMsg: msg });
        return { success: false, rungs: currentRungs, clarifications: currentClarifications };
      }
    }
  }

  async function runAllPending() {
    setIsRunningAll(true);
    const snapshot = [...batches];
    const pageCount = session?.pageCount ?? parsedPages?.length ?? 0;
    let currentRungs = accRungs;
    let currentClarifications = accClarifications;

    for (let i = 0; i < snapshot.length; i++) {
      if (snapshot[i].status === "done") continue;
      const result = await processBatch(
        i, currentRungs, currentClarifications, pageCount, snapshot.length, snapshot[i]
      );
      if (!result.success) break;
      currentRungs = result.rungs;
      currentClarifications = result.clarifications;
    }
    setIsRunningAll(false);
  }

  async function handleGoToStep2() {
    setIsRefining(true);
    try {
      const res = await fetch("/api/filter-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clarifications: accClarifications,
          manufacturer: session?.manufacturer ?? manufacturer,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { clarifications?: ClarificationQuestion[] };
        const refined = data.clarifications ?? accClarifications;
        onSessionUpdate({ clarifications: refined, activeStep: 2 });
      } else {
        onSessionUpdate({ activeStep: 2 });
      }
    } catch {
      onSessionUpdate({ activeStep: 2 });
    } finally {
      setIsRefining(false);
    }
  }

  async function handlePdfParse() {
    if (!file) return;
    setParseError("");
    setIsParsing(true);

    const sessionId = crypto.randomUUID();
    freshUploadSessionId.current = sessionId;

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sessionId", sessionId);
      const res = await fetch("/api/parse-pdf", { method: "POST", body: form });
      const data = await res.json() as {
        pages?: string[]; pageUrls?: string[]; pageCount?: number; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "PDF解析失敗");

      const allPages = data.pages ?? [];
      const pageUrls = data.pageUrls ?? [];
      const pageCount = allPages.length;

      const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model;
      const sessionName = `${file.name} — ${modelLabel} — ${new Date().toLocaleDateString("ja-JP")}`;

      setBatches(buildBatches(pageCount, []));
      setParsedPages(allPages);
      setAccRungs([]);
      setAccClarifications([]);
      setPhase("batch");

      onComplete({
        id: sessionId,
        name: sessionName,
        projectId,
        manufacturer,
        model,
        pdfName: file.name,
        pageCount,
        rungs: [],
        clarifications: [],
        activeStep: 1,
        pdfPageUrls: pageUrls,
      }, pageUrls);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "PDF解析エラー");
      freshUploadSessionId.current = null;
    } finally {
      setIsParsing(false);
    }
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    const p = await createProject(newProjectName.trim());
    setProjectId(p.id);
    setNewProjectName("");
    setShowNewProject(false);
    onProjectsChange();
  }

  const pageCount = session?.pageCount ?? parsedPages?.length ?? 0;
  const allDone = batches.length > 0 && batches.every((b) => b.status === "done");
  const hasPending = batches.some((b) => b.status === "pending" || b.status === "error");
  const hasAnyDone = batches.some((b) => b.status === "done");

  return (
    <StepCard
      step={1}
      title="PDF取り込み"
      status={isComplete ? "complete" : "active"}
      width={phase === "batch" ? "w-80" : "w-72"}
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      onEdit={onEdit}
      collapsedSummary={
        <p className="text-xs">
          {session?.pdfName} / {session?.manufacturer === "keyence" ? "キーエンス" : "三菱電機"} / {session?.pageCount}p
        </p>
      }
    >
      <div className="p-4 space-y-4">
        {isComplete ? (
          /* ── 完了サマリー ── */
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700 break-all">{session?.pdfName}</p>
            <p className="text-xs text-gray-500">
              {session?.manufacturer === "keyence" ? "キーエンス" : "三菱電機"} / {session?.pageCount} ページ
            </p>
            {session?.model && (
              <p className="text-xs text-blue-600 font-medium">
                {MODELS.find((m) => m.id === session.model)?.label ?? session.model}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* ── メーカー選択（常時表示） ── */}
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

            {/* ── モデル選択（常時表示） ── */}
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

            {phase === "batch" ? (
          /* ── バッチ処理フェーズ ── */
          <>
            {(session?.pdfName ?? file?.name) && (
              <div>
                <p className="text-sm font-medium text-gray-700 break-all">
                  {session?.pdfName ?? file?.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{pageCount} ページ</p>
              </div>
            )}

            {/* 全バッチ実行 / 再開 */}
            {hasPending && (
              <button
                onClick={runAllPending}
                disabled={isRunningAll}
                className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl
                  hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isRunningAll ? "実行中..." : `▶ ${hasAnyDone ? "再開" : "全バッチ実行"}`}
              </button>
            )}

            {/* バッチ一覧 */}
            <div className="space-y-1.5">
              {batches.map((batch) => {
                const isDone = batch.status === "done";
                const isRunning = batch.status === "running";
                const isError = batch.status === "error";

                return (
                  <div
                    key={batch.index}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs
                      ${isDone    ? "bg-green-50 border-green-200" :
                        isError   ? "bg-red-50 border-red-200" :
                        isRunning ? "bg-blue-50 border-blue-200" :
                                    "bg-gray-50 border-gray-200"}`}
                  >
                    {/* ステータスアイコン */}
                    <span className={`flex-shrink-0 font-bold
                      ${isDone ? "text-green-500" : isError ? "text-red-500" :
                        isRunning ? "text-blue-500 animate-spin" : "text-gray-300"}`}>
                      {isDone ? "✓" : isError ? "✗" : isRunning ? "⟳" : "○"}
                    </span>

                    {/* ページ範囲 */}
                    <span className={`flex-1 font-medium tabular-nums
                      ${isDone ? "text-green-700" : isError ? "text-red-700" :
                        isRunning ? "text-blue-700" : "text-gray-500"}`}>
                      p.{batch.pageStart}〜{batch.pageEnd}
                    </span>

                    {/* カウントダウン or エラー文言 */}
                    {batch.countdown !== undefined && (
                      <span className="text-amber-600 tabular-nums">{batch.countdown}秒</span>
                    )}
                    {isError && !batch.countdown && batch.errorMsg && (
                      <span className="text-red-400 truncate max-w-[72px]" title={batch.errorMsg}>
                        {batch.errorMsg.slice(0, 12)}
                      </span>
                    )}
                    {isRunning && !batch.countdown && (
                      <span className="text-blue-400">処理中</span>
                    )}

                    {/* アクションボタン */}
                    {!isDone && !isRunning && (
                      <button
                        onClick={() =>
                          processBatch(
                            batch.index, accRungs, accClarifications,
                            pageCount, batches.length, batch
                          )
                        }
                        disabled={isRunningAll}
                        className="flex-shrink-0 px-2 py-1 bg-blue-600 text-white rounded-lg
                          hover:bg-blue-700 disabled:opacity-40 transition-colors text-xs"
                      >
                        {isError ? "再試行" : "取り込む"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ステップ2を生成 */}
            <button
              onClick={handleGoToStep2}
              disabled={!allDone || isRefining}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isRefining ? "質問を精査中..." : "ステップ2を生成 →"}
            </button>
          </>
        ) : (
          /* ── アップロードフェーズ（メーカー・モデルは上部に表示済み） ── */
          <>
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
                  <input autoFocus value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateProject();
                      if (e.key === "Escape") setShowNewProject(false);
                    }}
                    placeholder="プロジェクト名"
                    className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-xs
                      focus:outline-none focus:border-blue-500" />
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
              onDrop={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault(); setIsDragging(false);
                const f = e.dataTransfer.files[0];
                if (f?.type === "application/pdf") { setFile(f); setParseError(""); }
                else setParseError("PDFファイルを選択してください");
              }}
              onClick={() => !isParsing && inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  if (f?.type === "application/pdf") { setFile(f); setParseError(""); }
                }} />
              {file ? (
                <p className="text-sm font-medium text-gray-800 break-all">{file.name}</p>
              ) : (
                <p className="text-sm text-gray-400">PDFをドロップ or クリック</p>
              )}
            </div>

            {parseError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{parseError}</p>
            )}

            <button
              onClick={handlePdfParse}
              disabled={!file || isParsing}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isParsing ? "解析中..." : "PDFを読み込む →"}
            </button>
          </>
        )}
          </>
        )}
      </div>
    </StepCard>
  );
}
