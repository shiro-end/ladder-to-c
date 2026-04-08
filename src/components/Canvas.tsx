"use client";

import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Step1Upload from "./steps/Step1Upload";
import Step2Interpretation from "./steps/Step2Interpretation";
import Step3ConversionTable from "./steps/Step3ConversionTable";
import Step4Generate from "./steps/Step4Generate";
import PdfPreviewPanel from "./PdfPreviewPanel";
import type { Session, Rung, ConversionEntry } from "@/types/session";

interface Props {
  session: Session | null;
  pdfPages: string[];
  onSessionUpdate: (updates: Partial<Session>) => void;
  onSessionCreate: (updates: Partial<Session>, pages: string[]) => void;
}

export default function Canvas({ session, pdfPages, onSessionUpdate, onSessionCreate }: Props) {
  const [focusedStep, setFocusedStep] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [previewPage, setPreviewPage] = useState<number | null>(null);

  function toggleFocus(step: number) {
    setFocusedStep((prev) => (prev === step ? null : step));
  }

  return (
    <div className="relative w-full h-full bg-gray-100 overflow-hidden">
      <TransformWrapper
        initialScale={1}
        minScale={0.3}
        maxScale={2}
        wheel={{ step: 0.08 }}
        panning={{ allowLeftClickPan: true, excluded: ["input", "textarea", "select", "button"] }}
        centerOnInit
        onTransform={(_, state) => setScale(state.scale)}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* ズームコントロール */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-white rounded-xl shadow-md border border-gray-200 px-2 py-1.5">
              <button
                onClick={() => zoomOut()}
                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-lg font-light"
              >
                −
              </button>
              <span className="text-xs text-gray-500 font-medium tabular-nums w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => zoomIn()}
                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-lg font-light"
              >
                +
              </button>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button
                onClick={() => resetTransform()}
                className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
              >
                リセット
              </button>
            </div>

            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ display: "flex", alignItems: "flex-start", gap: "20px", padding: "40px" }}
            >
              {/* Step 1 */}
              <Step1Upload
                session={session}
                isFocused={focusedStep === 1}
                onToggleFocus={() => toggleFocus(1)}
                onComplete={(updates, pages) => onSessionCreate(updates, pages)}
              />

              {/* Step 2 */}
              {session ? (
                <Step2Interpretation
                  session={session}
                  isFocused={focusedStep === 2}
                  onToggleFocus={() => toggleFocus(2)}
                  onPreviewPage={(page) => setPreviewPage(page)}
                  onUpdate={(rungs: Rung[]) => onSessionUpdate({ rungs })}
                  onComplete={(conversionTable: ConversionEntry[]) =>
                    onSessionUpdate({ conversionTable, activeStep: 3 })
                  }
                />
              ) : (
                <PlaceholderCard step={2} title="ラダー図の解釈" />
              )}

              {/* Step 3 */}
              {session ? (
                <Step3ConversionTable
                  session={session}
                  isFocused={focusedStep === 3}
                  onToggleFocus={() => toggleFocus(3)}
                  onUpdate={(table: ConversionEntry[]) => onSessionUpdate({ conversionTable: table })}
                  onComplete={(cCode: string, interpretationDoc: string) =>
                    onSessionUpdate({ cCode, interpretationDoc, activeStep: 4 })
                  }
                />
              ) : (
                <PlaceholderCard step={3} title="変換表" />
              )}

              {/* Step 4 */}
              {session ? (
                <Step4Generate
                  session={session}
                  isFocused={focusedStep === 4}
                  onToggleFocus={() => toggleFocus(4)}
                />
              ) : (
                <PlaceholderCard step={4} title="コード生成" />
              )}
            </TransformComponent>
          </>
        )}
      </TransformWrapper>

      {/* PDF プレビューパネル */}
      {previewPage !== null && (
        <PdfPreviewPanel
          pages={pdfPages}
          initialPage={previewPage}
          onClose={() => setPreviewPage(null)}
        />
      )}
    </div>
  );
}

function PlaceholderCard({ step, title }: { step: number; title: string }) {
  return (
    <div
      className="rounded-2xl border-2 border-dashed border-gray-200 bg-white/60 w-72 flex flex-col items-center justify-center py-12 px-6 gap-2"
      onWheel={(e) => e.stopPropagation()}
    >
      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Step {step}</span>
      <span className="text-sm text-gray-400">{title}</span>
    </div>
  );
}
