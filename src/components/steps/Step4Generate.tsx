"use client";

import { useState } from "react";
import StepCard from "@/components/StepCard";
import type { Session } from "@/types/session";

interface Props {
  session: Session;
  isFocused: boolean;
  onToggleFocus: () => void;
}

export default function Step4Generate({ session, isFocused, onToggleFocus }: Props) {
  const [tab, setTab] = useState<"code" | "doc">("code");

  const isActive = session.activeStep === 4;
  const isPending = session.activeStep < 4;

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
      status={isPending ? "pending" : "complete"}
      width="w-[480px]"
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      collapsedSummary={<p className="text-xs">変換表確定後に生成されます</p>}
    >
      {(isActive || !isPending) && (
        <div className="flex flex-col h-full">
          {/* タブ */}
          <div className="flex border-b border-gray-100 px-4 flex-shrink-0">
            {(["code", "doc"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                  ${tab === t
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                {t === "code" ? "C コード" : "解釈ドキュメント"}
              </button>
            ))}
          </div>

          {/* ツールバー */}
          <div className="flex items-center justify-end gap-2 px-4 py-2 flex-shrink-0">
            <button
              onClick={() => handleCopy(tab === "code" ? (session.cCode ?? "") : (session.interpretationDoc ?? ""))}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              コピー
            </button>
            <button
              onClick={() => {
                if (tab === "code") {
                  handleDownload(session.cCode ?? "", "ladder_output.c");
                } else {
                  handleDownload(session.interpretationDoc ?? "", "ladder_interpretation.md");
                }
              }}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              ダウンロード
            </button>
          </div>

          {/* コンテンツ */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {tab === "code" ? (
              <pre className="text-xs font-mono bg-gray-950 text-green-400 rounded-xl p-4 whitespace-pre-wrap break-all">
                {session.cCode ?? ""}
              </pre>
            ) : (
              <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {session.interpretationDoc ?? ""}
              </div>
            )}
          </div>
        </div>
      )}
    </StepCard>
  );
}
