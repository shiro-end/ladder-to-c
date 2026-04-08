"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import CodeViewer from "./CodeViewer";

type Manufacturer = "mitsubishi" | "keyence";
type Status = "idle" | "uploading" | "error";

export default function PdfUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [manufacturer, setManufacturer] = useState<Manufacturer>("mitsubishi");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) selectFile(selected);
  }

  function selectFile(selected: File) {
    if (selected.type !== "application/pdf") {
      setError("PDFファイルを選択してください");
      return;
    }
    setFile(selected);
    setError("");
    setGeneratedCode("");
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }

  async function handleConvert() {
    if (!file) return;

    setStatus("uploading");
    setError("");
    setGeneratedCode("");

    const form = new FormData();
    form.append("file", file);
    form.append("manufacturer", manufacturer);

    try {
      const res = await fetch("/api/convert", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "変換に失敗しました");
      }

      setGeneratedCode(data.code);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      {/* メーカー選択 */}
      <div className="flex gap-4">
        {(["mitsubishi", "keyence"] as Manufacturer[]).map((m) => (
          <label key={m} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="manufacturer"
              value={m}
              checked={manufacturer === m}
              onChange={() => setManufacturer(m)}
              className="accent-blue-600"
            />
            <span className="font-medium text-gray-700">
              {m === "mitsubishi" ? "三菱電機" : "キーエンス"}
            </span>
          </label>
        ))}
      </div>

      {/* ドロップゾーン */}
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:border-blue-400"}`}
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
          onChange={handleFileChange}
        />
        {file ? (
          <p className="text-gray-800 font-medium">{file.name}</p>
        ) : (
          <>
            <p className="text-gray-500">PDFをドロップ、またはクリックして選択</p>
            <p className="text-sm text-gray-400 mt-1">ラダー図PDFのみ対応</p>
          </>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* 変換ボタン */}
      <button
        onClick={handleConvert}
        disabled={!file || status === "uploading"}
        className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg
          hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "uploading" ? "変換中..." : "C言語コードに変換"}
      </button>

      {/* 生成コード表示 */}
      {generatedCode && <CodeViewer code={generatedCode} />}
    </div>
  );
}
