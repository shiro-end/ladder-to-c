"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import StepCard from "@/components/StepCard";
import type { Session, Manufacturer } from "@/types/session";
import type { Rung } from "@/types/session";
import { savePdfPages } from "@/lib/session-storage";

interface Props {
  session: Session | null;
  isFocused: boolean;
  onToggleFocus: () => void;
  onComplete: (updated: Partial<Session>, pages: string[]) => void;
}

export default function Step1Upload({ session, isFocused, onToggleFocus, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [manufacturer, setManufacturer] = useState<Manufacturer>(
    session?.manufacturer ?? "mitsubishi"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isComplete = session?.activeStep !== undefined && session.activeStep > 1;

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

  async function handleInterpret() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("manufacturer", manufacturer);

      const res = await fetch("/api/interpret", { method: "POST", body: form });
      const data = await res.json() as { rungs?: Rung[]; pages?: string[]; pageCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "解析失敗");

      const pages = data.pages ?? [];
      onComplete(
        {
          manufacturer,
          pdfName: file.name,
          pageCount: data.pageCount ?? pages.length,
          rungs: data.rungs ?? [],
          activeStep: 2,
        },
        pages
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const summary = isComplete
    ? `${session?.pdfName} / ${session?.manufacturer === "keyence" ? "キーエンス" : "三菱電機"} / ${session?.pageCount}ページ`
    : "PDFをアップロードしてください";

  return (
    <StepCard
      step={1}
      title="PDF取り込み"
      status={isComplete ? "complete" : "active"}
      width="w-72"
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      collapsedSummary={<p className="text-xs">{summary}</p>}
    >
      <div className="p-4 space-y-4">
        {isComplete ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">{session?.pdfName}</p>
            <p className="text-xs text-gray-500">
              {session?.manufacturer === "keyence" ? "キーエンス" : "三菱電機"} /{" "}
              {session?.pageCount} ページ
            </p>
            <button
              onClick={() => { setFile(null); setError(""); }}
              className="text-xs text-blue-600 hover:underline"
            >
              変更する
            </button>
          </div>
        ) : (
          <>
            {/* メーカー選択 */}
            <div className="flex gap-4">
              {(["mitsubishi", "keyence"] as Manufacturer[]).map((m) => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="manufacturer"
                    value={m}
                    checked={manufacturer === m}
                    onChange={() => setManufacturer(m)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    {m === "mitsubishi" ? "三菱電機" : "キーエンス"}
                  </span>
                </label>
              ))}
            </div>

            {/* ドロップゾーン */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  if (f) selectFile(f);
                }}
              />
              {file ? (
                <p className="text-sm font-medium text-gray-800 break-all">{file.name}</p>
              ) : (
                <p className="text-sm text-gray-400">PDFをドロップ or クリック</p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleInterpret}
              disabled={!file || loading}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "解析中..." : "ラダー図を解釈 →"}
            </button>
          </>
        )}
      </div>
    </StepCard>
  );
}
