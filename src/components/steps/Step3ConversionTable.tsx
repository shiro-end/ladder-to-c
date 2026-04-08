"use client";

import StepCard from "@/components/StepCard";
import type { Session, ConversionEntry } from "@/types/session";

interface Props {
  session: Session;
  isFocused: boolean;
  onToggleFocus: () => void;
  onUpdate: (table: ConversionEntry[]) => void;
  onComplete: () => void;
  onEdit?: () => void;
}

const DATA_TYPES = ["bool", "uint16_t", "uint32_t", "int16_t", "int32_t", "float"];

export default function Step3ConversionTable({
  session,
  isFocused,
  onToggleFocus,
  onUpdate,
  onComplete,
  onEdit,
}: Props) {
  const table = session.conversionTable ?? [];
  const isComplete = session.activeStep > 3;

  function updateEntry(id: string, field: keyof ConversionEntry, value: string) {
    onUpdate(table.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  function addRow() {
    onUpdate([
      ...table,
      { id: crypto.randomUUID(), plcDevice: "", cVariable: "", dataType: "bool", description: "" },
    ]);
  }

  function removeRow(id: string) {
    onUpdate(table.filter((e) => e.id !== id));
  }

  return (
    <StepCard
      step={3}
      title="変換表"
      status={isComplete ? "complete" : session.activeStep === 3 ? "active" : "pending"}
      width="w-[630px]"
      isFocused={isFocused}
      onToggleFocus={onToggleFocus}
      onEdit={onEdit}
      collapsedSummary={
        session.activeStep < 3 ? (
          <p className="text-xs">ラダー図解釈後に生成されます</p>
        ) : (
          <p className="text-xs">{table.length} デバイス対応済み</p>
        )
      }
    >
      {/* ── カラムヘッダー（sticky） ── */}
      <div className="sticky top-0 z-10 bg-white border-y border-gray-100 px-4 py-2">
        <div
          className={`grid gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide
            ${isComplete ? "grid-cols-[90px_1fr_100px_1fr]" : "grid-cols-[90px_1fr_100px_1fr_24px]"}`}
        >
          <span>PLCデバイス</span>
          <span>C変数名</span>
          <span>型</span>
          <span>説明</span>
          {!isComplete && <span />}
        </div>
      </div>

      {/* ── 行 ── */}
      <div className="px-4 py-2 space-y-1">
        {table.map((entry) => (
          <div
            key={entry.id}
            className={`grid gap-1 items-center
              ${isComplete ? "grid-cols-[90px_1fr_100px_1fr]" : "grid-cols-[90px_1fr_100px_1fr_24px]"}`}
          >
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
              {DATA_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
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

      {/* ── フッター ── */}
      <div className="px-4 pb-4 space-y-2">
        {!isComplete && (
          <button
            onClick={addRow}
            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            + 行を追加
          </button>
        )}
        {!isComplete && (
          <button
            onClick={onComplete}
            disabled={table.length === 0}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
              hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            変換表を確定 →
          </button>
        )}
      </div>
    </StepCard>
  );
}
