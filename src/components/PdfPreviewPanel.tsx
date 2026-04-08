"use client";

import { useState } from "react";

interface Props {
  pages: string[];
  initialPage: number;
  onClose: () => void;
}

export default function PdfPreviewPanel({ pages, initialPage, onClose }: Props) {
  const [current, setCurrent] = useState(initialPage);
  const totalPages = pages.length;
  const src = pages[current - 1];

  return (
    <div
      className="fixed right-4 top-16 bottom-4 w-80 z-40 bg-white rounded-2xl shadow-2xl
        border border-gray-200 flex flex-col animate-in slide-in-from-right-4 duration-200"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700">PDF プレビュー</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ページ画像 */}
      <div className="flex-1 overflow-y-auto p-3">
        {src ? (
          <img
            src={`data:image/png;base64,${src}`}
            alt={`PDF ページ ${current}`}
            className="w-full rounded-lg border border-gray-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs text-center">
              PDFを再アップロードすると<br />ページを表示できます
            </p>
          </div>
        )}
      </div>

      {/* ページ操作 */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={() => setCurrent((p) => Math.max(1, p - 1))}
          disabled={current <= 1}
          className="text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors p-1"
        >
          ←
        </button>
        <span className="text-sm text-gray-600 font-medium tabular-nums">
          {current} / {totalPages || "?"}
        </span>
        <button
          onClick={() => setCurrent((p) => Math.min(totalPages || p, p + 1))}
          disabled={current >= totalPages}
          className="text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors p-1"
        >
          →
        </button>
      </div>
    </div>
  );
}
