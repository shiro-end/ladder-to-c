"use client";

import { useState } from "react";
import StepCard from "@/components/StepCard";
import type { Session, ConversionEntry } from "@/types/session";

interface Props {
  session: Session;
  isFocused: boolean;
  onToggleFocus: () => void;
  onUpdate: (table: ConversionEntry[]) => void;
  onComplete: (cCode: string, interpretationDoc: string) => void;
}

const DATA_TYPES = ["bool", "uint16_t", "uint32_t", "int16_t", "int32_t", "float"];

export default function Step3ConversionTable({
  session,
  isFocused,
  onToggleFocus,
  onUpdate,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const table = session.conversionTable ?? [];
  const isComplete = session.activeStep > 3;

  function updateEntry(id: string, field: keyof ConversionEntry, value: string) {
    onUpdate(table.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  function addRow() {
    const newEntry: ConversionEntry = {
      id: crypto.randomUUID(),
      plcDevice: "",
      cVariable: "",
      dataType: "bool",
      description: "",
    };
    onUpdate([...table, newEntry]);
  }

  function removeRow(id: string) {
    onUpdate(table.filter((e) => e.id !== id));
  }

  async function handleGenerateCode() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rungs: session.rungs,
          conversionTable: table,
          manufacturer: session.manufacturer,
        }),
      });
      const data = await res.json() as { cCode?: string; interpretationDoc?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "生成失敗");
      onComplete(data.cCode ?? "", data.interpretationDoc ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepCard
      step={3}
      title="変換表"
      status={isComplete ? "complete" : session.activeStep === 3 ? "active" : "pending"}
      width="w-[420px]"
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      collapsedSummary={
        session.activeStep < 3
          ? <p className="text-xs">ラダー図解釈後に生成されます</p>
          : <p className="text-xs">{table.length} デバイス対応済み</p>
      }
    >
      <div className="p-4 space-y-3">
        {/* テーブルヘッダー */}
        <div className="grid grid-cols-[80px_1fr_90px_1fr] gap-1 px-1">
          {["PLCデバイス", "C変数名", "型", "説明"].map((h) => (
            <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {/* 行 */}
        <div className="space-y-1">
          {table.map((entry) => (
            <div key={entry.id} className="grid grid-cols-[80px_1fr_90px_1fr_24px] gap-1 items-center">
              <input
                value={entry.plcDevice}
                onChange={(e) => updateEntry(entry.id, "plcDevice", e.target.value)}
                disabled={isComplete}
                placeholder="X0"
                className="border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-xs
                  focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500 w-full"
              />
              <input
                value={entry.cVariable}
                onChange={(e) => updateEntry(entry.id, "cVariable", e.target.value)}
                disabled={isComplete}
                placeholder="input_start"
                className="border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-xs
                  focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500 w-full"
              />
              <select
                value={entry.dataType}
                onChange={(e) => updateEntry(entry.id, "dataType", e.target.value)}
                disabled={isComplete}
                className="border border-gray-200 rounded-lg px-1 py-1.5 text-xs
                  focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500 w-full"
              >
                {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                value={entry.description}
                onChange={(e) => updateEntry(entry.id, "description", e.target.value)}
                disabled={isComplete}
                placeholder="説明"
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs
                  focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500 w-full"
              />
              {!isComplete && (
                <button
                  onClick={() => removeRow(entry.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-center"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {!isComplete && (
          <button
            onClick={addRow}
            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            + 行を追加
          </button>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {!isComplete && (
          <button
            onClick={handleGenerateCode}
            disabled={loading || table.length === 0}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
              hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "コードを生成中..." : "Cコードを生成 →"}
          </button>
        )}
      </div>
    </StepCard>
  );
}
