"use client";

import { useState, useCallback } from "react";
import StepCard from "@/components/StepCard";
import type { Session, Rung, ConversionEntry, ClarificationQuestion } from "@/types/session";
import { MODELS, getModelLabel } from "@/lib/models";

const TABLE_BATCH_SIZE = 60;

type TableBatchStatus = "pending" | "running" | "done" | "error";

interface TableBatch {
  index: number;
  rungStart: number;
  rungEnd: number;
  status: TableBatchStatus;
  errorMsg?: string;
}

interface Props {
  session: Session;
  isFocused: boolean;
  onToggleFocus: () => void;
  onPreviewPage: (page: number) => void;
  onUpdate: (rungs: Rung[], clarifications: ClarificationQuestion[]) => void;
  onComplete: (conversionTable: ConversionEntry[]) => void;
  onEdit?: () => void;
  onModelChange?: (model: string) => void;
}

function buildTableBatches(rungs: Rung[]): TableBatch[] {
  const total = Math.ceil(rungs.length / TABLE_BATCH_SIZE);
  return Array.from({ length: total }, (_, i) => {
    const start = i * TABLE_BATCH_SIZE;
    const end = Math.min(start + TABLE_BATCH_SIZE - 1, rungs.length - 1);
    return {
      index: i,
      rungStart: rungs[start]?.number ?? start + 1,
      rungEnd: rungs[end]?.number ?? end + 1,
      status: "pending" as TableBatchStatus,
    };
  });
}

export default function Step2Interpretation({
  session,
  isFocused,
  onToggleFocus,
  onPreviewPage,
  onUpdate,
  onComplete,
  onEdit,
  onModelChange,
}: Props) {
  const [error, setError] = useState("");
  const [rungesExpanded, setRungesExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(session.model ?? "claude-opus-4-6");

  // generate-table バッチ状態
  const [tableBatches, setTableBatches] = useState<TableBatch[]>([]);
  const [accEntries, setAccEntries] = useState<ConversionEntry[]>([]);
  const [isRunningTable, setIsRunningTable] = useState(false);
  const [tablePhase, setTablePhase] = useState<"idle" | "batching" | "done">("idle");

  const rungs = session.rungs ?? [];
  const clarifications = session.clarifications ?? [];
  const isComplete = session.activeStep > 2;
  const hasClarifications = clarifications.length > 0;

  function updateAnswer(id: string, answer: string) {
    onUpdate(rungs, clarifications.map((c) => (c.id === id ? { ...c, answer } : c)));
  }

  function updateRung(id: string, field: keyof Rung, value: string) {
    onUpdate(rungs.map((r) => (r.id === id ? { ...r, [field]: value } : r)), clarifications);
  }

  function updateTableBatch(index: number, updates: Partial<TableBatch>) {
    setTableBatches((prev) => prev.map((b, i) => (i === index ? { ...b, ...updates } : b)));
  }

  const startBatching = useCallback(() => {
    const batches = buildTableBatches(rungs);
    setTableBatches(batches);
    setAccEntries([]);
    setTablePhase("batching");
    setError("");
    onModelChange?.(selectedModel);
  }, [rungs, selectedModel, onModelChange]);

  async function processTableBatch(
    batchIndex: number,
    currentEntries: ConversionEntry[],
    batches: TableBatch[],
  ): Promise<{ success: boolean; entries: ConversionEntry[] }> {
    updateTableBatch(batchIndex, { status: "running", errorMsg: undefined });

    const start = batchIndex * TABLE_BATCH_SIZE;
    const batchRungs = rungs.slice(start, start + TABLE_BATCH_SIZE);

    try {
      const res = await fetch("/api/generate-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rungs: batchRungs,
          manufacturer: session.manufacturer,
          model: selectedModel,
        }),
      });
      const data = await res.json() as { entries?: ConversionEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "エラー");

      // 重複除外してマージ
      const seen = new Set(currentEntries.map((e) => e.plcDevice));
      const merged = [...currentEntries];
      for (const entry of data.entries ?? []) {
        if (!seen.has(entry.plcDevice)) {
          seen.add(entry.plcDevice);
          merged.push(entry);
        }
      }

      setAccEntries(merged);
      updateTableBatch(batchIndex, { status: "done" });

      // 全バッチ完了チェック
      const updatedBatches = batches.map((b, i) =>
        i === batchIndex ? { ...b, status: "done" as TableBatchStatus } : b
      );
      if (updatedBatches.every((b) => b.status === "done")) {
        setTablePhase("done");
      }

      return { success: true, entries: merged };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "エラー";
      updateTableBatch(batchIndex, { status: "error", errorMsg: msg });
      return { success: false, entries: currentEntries };
    }
  }

  async function runAllTableBatches() {
    const batches = buildTableBatches(rungs);
    setTableBatches(batches);
    setAccEntries([]);
    setTablePhase("batching");
    setError("");
    onModelChange?.(selectedModel);
    setIsRunningTable(true);

    let current: ConversionEntry[] = [];
    for (let i = 0; i < batches.length; i++) {
      const result = await processTableBatch(i, current, batches);
      if (!result.success) break;
      current = result.entries;
    }
    setIsRunningTable(false);
  }

  // PLCデバイス名でソート
  function sortAndConfirm() {
    const order = ["X", "Y", "M", "T", "C", "D", "R"];
    const sorted = [...accEntries].sort((a, b) => {
      const ai = order.findIndex((p) => a.plcDevice.startsWith(p));
      const bi = order.findIndex((p) => b.plcDevice.startsWith(p));
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.plcDevice.localeCompare(b.plcDevice, undefined, { numeric: true });
    });
    onComplete(sorted);
  }

  const allTableDone = tableBatches.length > 0 && tableBatches.every((b) => b.status === "done");
  const hasPendingTable = tableBatches.some((b) => b.status === "pending" || b.status === "error");
  const hasAnyTableDone = tableBatches.some((b) => b.status === "done");

  return (
    <StepCard
      step={2}
      title="ラダー図の解釈"
      status={isComplete ? "complete" : "active"}
      width="w-[480px]"
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      onEdit={onEdit}
      collapsedSummary={<p className="text-xs">{rungs.length} ラング解析済み</p>}
    >
      <div className="p-4 space-y-4">

        {/* ── モデル選択 ── */}
        {isComplete ? (
          <p className="text-xs text-blue-600 font-medium">
            使用モデル: {getModelLabel(selectedModel)}
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">変換表生成に使うモデル</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {MODELS.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="model-step2" value={m.id}
                    checked={selectedModel === m.id} onChange={() => setSelectedModel(m.id)}
                    className="accent-blue-600" />
                  <span className="text-sm text-gray-700">{m.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── 確認事項セクション ── */}
        {hasClarifications && (
          <div className="border border-amber-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
              <span className="text-amber-500">⚠</span>
              <span className="text-sm font-semibold text-amber-800">確認事項</span>
              <span className="text-xs text-amber-600 ml-auto">
                {clarifications.filter((c) => c.answer.trim()).length}/{clarifications.length} 回答済み
              </span>
            </div>
            <div className="divide-y divide-amber-100">
              {clarifications.map((c, i) => (
                <div key={c.id} className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">Q{i + 1}. {c.question}</p>
                  <p className="text-xs text-gray-400">{c.context}</p>
                  <textarea
                    value={c.answer}
                    onChange={(e) => updateAnswer(c.id, e.target.value)}
                    disabled={isComplete}
                    placeholder="回答を入力..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none
                      focus:outline-none focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ラング一覧（折りたたみ） ── */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setRungesExpanded((v) => !v)}
            className="flex items-center justify-between w-full px-4 py-2.5 bg-gray-50
              hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-sm font-medium text-gray-600">ラング詳細 ({rungs.length} 件)</span>
            <span className="text-gray-400 text-xs">{rungesExpanded ? "▲ 閉じる" : "▼ 展開"}</span>
          </button>
          {rungesExpanded && (
            <div className="divide-y divide-gray-100">
              {rungs.map((rung) => (
                <div key={rung.id} className="p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      RUNG {rung.number}
                    </span>
                    <button
                      onClick={() => onPreviewPage(rung.pageNumber)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800
                        hover:bg-blue-50 rounded-md px-2 py-0.5 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      p.{rung.pageNumber}
                    </button>
                  </div>
                  {rung.warning && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
                      <p className="text-xs text-amber-800">{rung.warning}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                    <span className="text-gray-500 pt-1.5 font-medium">入力</span>
                    <input value={rung.inputs}
                      onChange={(e) => updateRung(rung.id, "inputs", e.target.value)}
                      disabled={isComplete}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono text-xs
                        focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500" />
                    <span className="text-gray-500 pt-1.5 font-medium">出力</span>
                    <input value={rung.output}
                      onChange={(e) => updateRung(rung.id, "output", e.target.value)}
                      disabled={isComplete}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono text-xs
                        focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500" />
                    <span className="text-gray-500 pt-1.5 font-medium">メモ</span>
                    <input value={rung.comment}
                      onChange={(e) => updateRung(rung.id, "comment", e.target.value)}
                      disabled={isComplete}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-xs
                        focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {/* ── 変換表生成エリア ── */}
        {!isComplete && (
          <>
            {tablePhase === "idle" ? (
              /* 開始ボタン */
              <button
                onClick={runAllTableBatches}
                disabled={rungs.length === 0}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                  hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                変換表を生成 →
              </button>
            ) : (
              /* バッチ進捗 */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">
                    変換表生成 ({tableBatches.filter((b) => b.status === "done").length}/{tableBatches.length} 完了)
                  </p>
                  {hasPendingTable && !isRunningTable && (
                    <button
                      onClick={runAllTableBatches}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      ▶ {hasAnyTableDone ? "再開" : "全実行"}
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {tableBatches.map((batch) => {
                    const isDone = batch.status === "done";
                    const isRunning = batch.status === "running";
                    const isError = batch.status === "error";
                    return (
                      <div
                        key={batch.index}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs
                          ${isDone ? "bg-green-50 border-green-200" :
                            isError ? "bg-red-50 border-red-200" :
                            isRunning ? "bg-blue-50 border-blue-200" :
                            "bg-gray-50 border-gray-200"}`}
                      >
                        <span className={`flex-shrink-0 font-bold
                          ${isDone ? "text-green-500" : isError ? "text-red-500" :
                            isRunning ? "text-blue-500" : "text-gray-300"}`}>
                          {isDone ? "✓" : isError ? "✗" : isRunning ? "⟳" : "○"}
                        </span>
                        <span className={`flex-1 font-medium tabular-nums
                          ${isDone ? "text-green-700" : isError ? "text-red-700" :
                            isRunning ? "text-blue-700" : "text-gray-500"}`}>
                          RUNG {batch.rungStart}〜{batch.rungEnd}
                        </span>
                        {isRunning && <span className="text-blue-400">処理中</span>}
                        {isError && batch.errorMsg && (
                          <span className="text-red-400 truncate max-w-[80px]" title={batch.errorMsg}>
                            {batch.errorMsg.slice(0, 14)}
                          </span>
                        )}
                        {!isDone && !isRunning && (
                          <button
                            onClick={() => processTableBatch(batch.index, accEntries, tableBatches)}
                            disabled={isRunningTable}
                            className="flex-shrink-0 px-2 py-1 bg-blue-600 text-white rounded-lg
                              hover:bg-blue-700 disabled:opacity-40 transition-colors text-xs"
                          >
                            {isError ? "再試行" : "実行"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {allTableDone && (
                  <button
                    onClick={sortAndConfirm}
                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                      hover:bg-blue-700 transition-colors"
                  >
                    変換表を確定 ({accEntries.length} デバイス) →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </StepCard>
  );
}
