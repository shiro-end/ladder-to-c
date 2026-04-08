"use client";

import { ReactNode, useEffect, useRef } from "react";

interface StepCardProps {
  step: number;
  title: string;
  status: "pending" | "active" | "complete";
  width: string;
  isFocused: boolean;
  onToggleFocus: () => void;
  onEdit?: () => void;
  children: ReactNode;
  collapsedSummary?: ReactNode;
}

const statusStyles = {
  pending: "border-gray-200 bg-white",
  active: "border-blue-400 bg-white shadow-lg shadow-blue-100",
  complete: "border-green-300 bg-white",
};

const statusBadge = {
  pending: <span className="text-xs text-gray-400 font-medium">○ 待機中</span>,
  active: <span className="text-xs text-blue-600 font-semibold">● 編集中</span>,
  complete: <span className="text-xs text-green-600 font-semibold">✓ 完了</span>,
};

/**
 * スクロール可能な div に native wheel リスナーを付けて
 * react-zoom-pan-pinch のズームハンドラへの伝播を阻止する
 */
function useBlockCanvasZoom(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    el.addEventListener("wheel", handler, { passive: true });
    return () => el.removeEventListener("wheel", handler);
  }, [ref]);
}

export default function StepCard({
  step,
  title,
  status,
  width,
  isFocused,
  onToggleFocus,
  onEdit,
  children,
  collapsedSummary,
}: StepCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useBlockCanvasZoom(scrollRef);

  const isExpanded = status === "active" || status === "complete";

  if (isFocused) {
    return (
      <div className="fixed inset-4 z-50 flex flex-col bg-white border border-blue-400 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Step {step}
            </span>
            <span className="font-semibold text-gray-800">{title}</span>
            {statusBadge[status]}
          </div>
          <div className="flex items-center gap-2">
            {status === "complete" && onEdit && (
              <button
                onClick={onEdit}
                title="編集に戻す"
                className="text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors"
              >
                ✎ 編集に戻す
              </button>
            )}
            <button
              onClick={onToggleFocus}
              className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ← 戻る
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 transition-all duration-200 ${statusStyles[status]} ${width}`}
      style={{ maxHeight: "calc((100vh - 80px) * 2)" }}
    >
      {/* カードヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex-shrink-0">
            Step {step}
          </span>
          <span className="font-semibold text-gray-800 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {statusBadge[status]}
          {status === "complete" && onEdit && (
            <button
              onClick={onEdit}
              title="編集に戻す"
              className="text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors"
            >
              ✎ 編集に戻す
            </button>
          )}
          {isExpanded && (
            <button
              onClick={onToggleFocus}
              title="フォーカスモード"
              className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* カードコンテンツ */}
      {status === "pending" ? (
        <div className="px-4 py-6 text-sm text-gray-400 text-center">{collapsedSummary}</div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      )}
    </div>
  );
}
