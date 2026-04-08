"use client";

import { MODELS, DEFAULT_MODEL, getModelLabel, useModelUnlock } from "@/lib/models";

interface Props {
  selectedModel: string;
  onChange: (model: string) => void;
  radioName: string;
  /** 完了後の表示（ラジオなし、使用モデル名のみ） */
  readOnly?: boolean;
}

export default function ModelSelector({ selectedModel, onChange, radioName, readOnly }: Props) {
  const { unlocked, handleTripleClick } = useModelUnlock();

  if (readOnly) {
    return (
      <p className="text-xs text-blue-600 font-medium">
        使用モデル: {getModelLabel(selectedModel)}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p
        className="text-xs font-medium text-gray-500 select-none cursor-default"
        onClick={handleTripleClick}
        title={unlocked ? "クリック×3でロック" : ""}
      >
        使用モデル{" "}
        {!unlocked && <span className="text-gray-300 text-[10px]">🔒</span>}
        {unlocked && <span className="text-green-400 text-[10px]">🔓</span>}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {MODELS.map((m) => {
          const isLocked = !unlocked && m.id !== DEFAULT_MODEL;
          return (
            <label
              key={m.id}
              className={`flex items-center gap-1.5 ${isLocked ? "cursor-not-allowed opacity-30" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name={radioName}
                value={m.id}
                checked={selectedModel === m.id}
                onChange={() => !isLocked && onChange(m.id)}
                disabled={isLocked}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{m.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
