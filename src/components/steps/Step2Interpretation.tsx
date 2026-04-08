"use client";

import { useState } from "react";
import StepCard from "@/components/StepCard";
import type { Session, Rung, ConversionEntry } from "@/types/session";

interface Props {
  session: Session;
  isFocused: boolean;
  onToggleFocus: () => void;
  onPreviewPage: (page: number) => void;
  onUpdate: (rungs: Rung[]) => void;
  onComplete: (conversionTable: ConversionEntry[]) => void;
}

export default function Step2Interpretation({
  session,
  isFocused,
  onToggleFocus,
  onPreviewPage,
  onUpdate,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rungs = session.rungs ?? [];
  const isComplete = session.activeStep > 2;

  function updateRung(id: string, field: keyof Rung, value: string) {
    const updated = rungs.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    onUpdate(updated);
  }

  async function handleGenerateTable() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rungs, manufacturer: session.manufacturer }),
      });
      const data = await res.json() as { conversionTable?: ConversionEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "生成失敗");
      onComplete(data.conversionTable ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepCard
      step={2}
      title="ラダー図の解釈"
      status={isComplete ? "complete" : "active"}
      width="w-[480px]"
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      collapsedSummary={<p className="text-xs">{rungs.length} ラング解析済み</p>}
    >
      <div className="p-4 space-y-3">
        {rungs.map((rung) => (
          <div key={rung.id} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
            {/* ヘッダー行 */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                RUNG {rung.number}
              </span>
              <button
                onClick={() => onPreviewPage(rung.pageNumber)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md px-2 py-0.5 transition-colors"
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

            {/* 警告 */}
            {rung.warning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
                <p className="text-xs text-amber-800">{rung.warning}</p>
              </div>
            )}

            {/* 編集フィールド */}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <span className="text-gray-500 pt-1.5 font-medium">入力</span>
              <input
                value={rung.inputs}
                onChange={(e) => updateRung(rung.id, "inputs", e.target.value)}
                disabled={isComplete}
                className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono text-xs
                  focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500"
              />
              <span className="text-gray-500 pt-1.5 font-medium">出力</span>
              <input
                value={rung.output}
                onChange={(e) => updateRung(rung.id, "output", e.target.value)}
                disabled={isComplete}
                className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono text-xs
                  focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500"
              />
              <span className="text-gray-500 pt-1.5 font-medium">メモ</span>
              <input
                value={rung.comment}
                onChange={(e) => updateRung(rung.id, "comment", e.target.value)}
                disabled={isComplete}
                className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-xs
                  focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>
        ))}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {!isComplete && (
          <button
            onClick={handleGenerateTable}
            disabled={loading || rungs.length === 0}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
              hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "変換表を生成中..." : "変換表を生成 →"}
          </button>
        )}
      </div>
    </StepCard>
  );
}
