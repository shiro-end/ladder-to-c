"use client";

import { useState } from "react";
import StepCard from "@/components/StepCard";
import type { Session, Rung, ConversionEntry } from "@/types/session";
import { MODELS, getModelLabel } from "@/lib/models";

interface Props {
  session: Session;
  isFocused: boolean;
  onToggleFocus: () => void;
  onComplete: (cCode: string, interpretationDoc: string) => void;
  onModelChange?: (model: string) => void;
}

const CODE_BATCH_SIZE = 30;

interface CodeBatch {
  index: number;
  startRung: number;
  endRung: number;
  rungs: Rung[];
  status: "pending" | "running" | "done" | "error";
  error?: string;
}

/** ラングに登場するデバイス名のみ変換表からフィルタ */
function filterTableForRungs(rungs: Rung[], table: ConversionEntry[]): ConversionEntry[] {
  const mentioned = new Set<string>();
  for (const rung of rungs) {
    const text = `${rung.inputs} ${rung.output}`;
    const matches = text.match(/\b([XYMTCDRG]\d+[A-Z]?\d*)\b/gi) ?? [];
    for (const m of matches) mentioned.add(m.toUpperCase());
  }
  return table.filter((e) => mentioned.has(e.plcDevice.toUpperCase()));
}

/** 変換表からCヘッダーを機械的に生成 */
function generateCHeader(table: ConversionEntry[], manufacturer: string): string {
  const manufacturerName = manufacturer === "keyence" ? "キーエンス" : "三菱電機";
  const date = new Date().toISOString().split("T")[0];

  const lines: string[] = [
    "/**",
    " * Auto-generated C code from PLC Ladder Diagram",
    ` * Manufacturer: ${manufacturerName}`,
    ` * Generated: ${date}`,
    " * Note: Items marked with ⚠ require manual verification",
    " */",
    "",
    "#include <stdint.h>",
    "#include <stdbool.h>",
    "",
  ];

  const groupOrder = ["X", "Y", "M", "T", "C", "D", "R"];
  const groupLabels: Record<string, string> = {
    X: "入力デバイス", Y: "出力デバイス", M: "内部リレー",
    T: "タイマー", C: "カウンター", D: "データレジスタ", R: "リンクリレー",
  };

  const groups: Record<string, ConversionEntry[]> = {};
  for (const entry of table) {
    const prefix = entry.plcDevice.replace(/\d.*/, "").toUpperCase();
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(entry);
  }

  const allPrefixes = [
    ...groupOrder,
    ...Object.keys(groups).filter((p) => !groupOrder.includes(p)),
  ];
  for (const prefix of allPrefixes) {
    if (!groups[prefix]?.length) continue;
    lines.push(`/* ── ${groupLabels[prefix] ?? prefix} ── */`);
    for (const e of groups[prefix]) {
      lines.push(`${e.dataType} ${e.cVariable}; /* ${e.plcDevice}  ${e.description} */`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** スニペットをscan_cycle関数に組み立て */
function assembleCCode(
  header: string,
  snippets: { rungNumber: number; cSnippet: string }[]
): string {
  const sorted = [...snippets].sort((a, b) => a.rungNumber - b.rungNumber);
  const body = sorted
    .map((s) => `  ${s.cSnippet.replace(/\n/g, "\n  ")}`)
    .join("\n\n");
  return `${header}\nvoid plc_scan_cycle(void) {\n\n${body}\n}\n`;
}

export default function Step4Generate({
  session,
  isFocused,
  onToggleFocus,
  onComplete,
  onModelChange,
}: Props) {
  const [tab, setTab] = useState<"code" | "doc">("code");
  const [selectedModel, setSelectedModel] = useState<string>(
    session.model ?? "claude-sonnet-4-6"
  );

  // フェーズ1: Cコード バッチ生成
  const [codeBatches, setCodeBatches] = useState<CodeBatch[]>([]);
  const [accSnippets, setAccSnippets] = useState<{ rungNumber: number; cSnippet: string }[]>([]);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [codePhase, setCodePhase] = useState<"idle" | "batching" | "done">("idle");

  // フェーズ2: 解釈ドキュメント生成
  const [isRunningDoc, setIsRunningDoc] = useState(false);

  const [error, setError] = useState("");

  const rungs = session.rungs ?? [];
  const table = session.conversionTable ?? [];
  const isPending = session.activeStep < 4;
  const hasCCode = !!session.cCode;
  const hasDoc = !!session.interpretationDoc;

  // ── フェーズ1 ──────────────────────────────────────────
  function buildCodeBatches(): CodeBatch[] {
    const batches: CodeBatch[] = [];
    for (let i = 0; i < rungs.length; i += CODE_BATCH_SIZE) {
      const batchRungs = rungs.slice(i, i + CODE_BATCH_SIZE);
      batches.push({
        index: batches.length,
        startRung: batchRungs[0].number,
        endRung: batchRungs[batchRungs.length - 1].number,
        rungs: batchRungs,
        status: "pending",
      });
    }
    return batches;
  }

  async function processCodeBatch(
    batchIndex: number,
    current: { rungNumber: number; cSnippet: string }[],
    batches: CodeBatch[]
  ): Promise<{ rungNumber: number; cSnippet: string }[]> {
    const batch = batches[batchIndex];
    const filteredTable = filterTableForRungs(batch.rungs, table);

    setCodeBatches((prev) =>
      prev.map((b) => (b.index === batchIndex ? { ...b, status: "running" } : b))
    );

    const res = await fetch("/api/generate-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rungs: batch.rungs,
        conversionTable: filteredTable,
        manufacturer: session.manufacturer,
        model: selectedModel,
      }),
    });
    const data = (await res.json()) as {
      snippets?: { rungNumber: number; cSnippet: string }[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "コード生成失敗");

    const snippets = data.snippets ?? [];
    const merged = [...current, ...snippets];

    setCodeBatches((prev) =>
      prev.map((b) => (b.index === batchIndex ? { ...b, status: "done" } : b))
    );
    setAccSnippets(merged);
    return merged;
  }

  async function runAllCodeBatches() {
    setIsRunningCode(true);
    setError("");
    onModelChange?.(selectedModel);
    const batches = buildCodeBatches();
    setCodeBatches(batches);
    setAccSnippets([]);
    setCodePhase("batching");

    let current: { rungNumber: number; cSnippet: string }[] = [];
    for (let i = 0; i < batches.length; i++) {
      try {
        current = await processCodeBatch(i, current, batches);
      } catch (e) {
        setCodeBatches((prev) =>
          prev.map((b) =>
            b.index === i
              ? { ...b, status: "error", error: e instanceof Error ? e.message : "エラー" }
              : b
          )
        );
        setError(`バッチ ${i + 1} でエラーが発生しました`);
        setIsRunningCode(false);
        return;
      }
    }

    // ヘッダー生成 + 組み立て
    const header = generateCHeader(table, session.manufacturer);
    const cCode = assembleCCode(header, current);
    onComplete(cCode, session.interpretationDoc ?? "");
    setCodePhase("done");
    setIsRunningCode(false);
  }

  // ── フェーズ2 ──────────────────────────────────────────
  async function handleGenerateDoc() {
    setIsRunningDoc(true);
    setError("");
    try {
      const res = await fetch("/api/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cCode: session.cCode,
          conversionTable: table,
          clarifications: session.clarifications,
          manufacturer: session.manufacturer,
          model: selectedModel,
        }),
      });
      const data = (await res.json()) as {
        interpretationDoc?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "ドキュメント生成失敗");
      onComplete(session.cCode ?? "", data.interpretationDoc ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsRunningDoc(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
  }

  function handleDownload(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <StepCard
      step={4}
      title="コード生成"
      status={isPending ? "pending" : hasCCode ? "complete" : "active"}
      width="w-[520px]"
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      collapsedSummary={<p className="text-xs">変換表確定後に生成されます</p>}
    >
      {!isPending && (
        <div className="flex flex-col h-full">

          {/* ── モデル選択（コード未生成時のみ） ── */}
          {!hasCCode && (
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-medium text-gray-500 mb-1">コード生成に使うモデル</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {MODELS.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="model-step4"
                      value={m.id}
                      checked={selectedModel === m.id}
                      onChange={() => setSelectedModel(m.id)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {hasCCode && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs text-blue-600 font-medium">
                使用モデル: {getModelLabel(selectedModel)}
              </p>
            </div>
          )}

          {/* ── フェーズ1開始ボタン ── */}
          {!hasCCode && codePhase === "idle" && (
            <div className="px-4 pb-4 pt-2">
              <button
                onClick={runAllCodeBatches}
                disabled={isRunningCode || rungs.length === 0}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                  hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Cコードを生成 →
              </button>
            </div>
          )}

          {/* ── フェーズ1 バッチ進捗 ── */}
          {codePhase === "batching" && (
            <div className="px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 mb-2">Cコード生成中...</p>
              {codeBatches.map((b) => (
                <div key={b.index} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-4 text-center flex-shrink-0 ${
                      b.status === "done"
                        ? "text-green-500"
                        : b.status === "running"
                        ? "text-blue-500"
                        : b.status === "error"
                        ? "text-red-500"
                        : "text-gray-300"
                    }`}
                  >
                    {b.status === "done"
                      ? "✓"
                      : b.status === "running"
                      ? "●"
                      : b.status === "error"
                      ? "✗"
                      : "○"}
                  </span>
                  <span
                    className={`font-mono ${
                      b.status === "pending" ? "text-gray-400" : "text-gray-700"
                    }`}
                  >
                    RUNG {b.startRung}〜{b.endRung}
                  </span>
                  {b.status === "error" && (
                    <span className="text-red-500 text-xs">{b.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── フェーズ2ボタン（Cコード完了・ドキュメント未生成） ── */}
          {hasCCode && !hasDoc && codePhase !== "batching" && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-700 font-medium">Cコード生成完了</span>
                <span className="text-xs text-gray-400">({rungs.length} ラング)</span>
              </div>
              <button
                onClick={handleGenerateDoc}
                disabled={isRunningDoc}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl
                  hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isRunningDoc ? "解釈ドキュメントを生成中..." : "解釈ドキュメントを生成 →"}
              </button>
            </div>
          )}

          {/* ── エラー ── */}
          {error && (
            <div className="px-4 pb-2">
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            </div>
          )}

          {/* ── タブ + コンテンツ（Cコード生成後） ── */}
          {hasCCode && (
            <>
              <div className="flex border-b border-gray-100 px-4 flex-shrink-0">
                {(["code", "doc"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                      ${
                        tab === t
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    {t === "code" ? "C コード" : "解釈ドキュメント"}
                  </button>
                ))}
              </div>

              {/* ツールバー */}
              {((tab === "code" && session.cCode) ||
                (tab === "doc" && session.interpretationDoc)) && (
                <div className="flex items-center justify-end gap-2 px-4 py-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      handleCopy(
                        tab === "code"
                          ? (session.cCode ?? "")
                          : (session.interpretationDoc ?? "")
                      )
                    }
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  >
                    コピー
                  </button>
                  <button
                    onClick={() => {
                      if (tab === "code")
                        handleDownload(session.cCode ?? "", "ladder_output.c");
                      else
                        handleDownload(
                          session.interpretationDoc ?? "",
                          "ladder_interpretation.md"
                        );
                    }}
                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    ダウンロード
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {tab === "code" ? (
                  <pre className="text-xs font-mono bg-gray-950 text-green-400 rounded-xl p-4 whitespace-pre-wrap break-all">
                    {session.cCode}
                  </pre>
                ) : session.interpretationDoc ? (
                  <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {session.interpretationDoc}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                    上のボタンから解釈ドキュメントを生成してください
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </StepCard>
  );
}
