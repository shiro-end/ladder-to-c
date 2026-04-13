"use client";

import { getModelLabel } from "@/lib/models";

interface Props {
  selectedModel: string;
  onChange?: (model: string) => void;
  radioName?: string;
  readOnly?: boolean;
}

export default function ModelSelector({ selectedModel }: Props) {
  return (
    <p className="text-xs text-gray-500">
      使用モデル: <span className="font-medium text-gray-700">{getModelLabel(selectedModel)}</span>
    </p>
  );
}
