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
        smooth={false}
        wheel={{ step: 0.1 }}
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
                  onUpdate={(rungs: Rung[], clarifications) => onSessionUpdate({ rungs, clarifications })}
                  onComplete={(conversionTable: ConversionEntry[]) =>
                    onSessionUpdate({ conversionTable, activeStep: 3 })
                  }
                />
              ) : (
                <MockInterpretationCard />
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
                <MockConversionTableCard />
              )}

              {/* Step 4 */}
              {session ? (
                <Step4Generate
                  session={session}
                  isFocused={focusedStep === 4}
                  onToggleFocus={() => toggleFocus(4)}
                />
              ) : (
                <MockCodeCard />
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

/* ── モックカード共通ヘッダー ── */
function MockHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Step {step}</span>
        <span className="font-semibold text-gray-400">{title}</span>
      </div>
      <span className="text-xs bg-gray-100 text-gray-400 rounded-full px-2 py-0.5">サンプル</span>
    </div>
  );
}

/* ── Step 2 モック：ラダー図解釈 ── */
function MockInterpretationCard() {
  const mockClarifications = [
    {
      id: "q1",
      question: "R39001はタッチパネル上のHMIボタンですか？機体の物理スイッチですか？",
      context: "搭乗/遠隔の切り替え操作場所によって制御フローの説明が変わります",
      answer: "",
    },
    {
      id: "q2",
      question: "ステップ45・48の -500 オフセットは中立位置の補正ですか？ユニット固有のズレ補正ですか？",
      context: "意味がわかると制御の意図を正確にコードコメントに反映できます",
      answer: "",
    },
    {
      id: "q3",
      question: "DM9/DM10 への遠隔指令の通信方式（UDP/TCP等）を教えてください",
      context: "通信断時の挙動説明に必要です",
      answer: "",
    },
  ];

  const mockRungs = [
    { number: 1, page: 1, inputs: "X0 AND X1", output: "Y0 (OUT)", comment: "起動条件", warning: null },
    { number: 2, page: 1, inputs: "M100", output: "Y1 (SET)", comment: "モーター正転", warning: "M100は変換表に影響します" },
    { number: 3, page: 2, inputs: "T0 AND NOT X5", output: "Y2 (OUT)", comment: "タイマー制御", warning: null },
  ];

  return (
    <div
      className="flex flex-col rounded-2xl border-2 border-gray-200 bg-white w-[480px] select-none"
      style={{ maxHeight: "calc(100vh - 80px)" }}
      onWheel={(e) => e.stopPropagation()}
    >
      <MockHeader step={2} title="ラダー図の解釈" />
      <div className="p-4 space-y-4 overflow-y-auto">

        {/* 確認事項セクション（モック） */}
        <div className="border border-amber-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
            <span className="text-amber-500">⚠</span>
            <span className="text-sm font-semibold text-amber-800">確認事項</span>
            <span className="text-xs text-amber-600 ml-auto">0 / 3 回答済み</span>
          </div>
          <div className="divide-y divide-amber-100">
            {mockClarifications.map((c, i) => (
              <div key={c.id} className="p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Q{i + 1}. {c.question}</p>
                <p className="text-xs text-gray-400">{c.context}</p>
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-300 bg-gray-50 min-h-[40px]">
                  回答を入力...
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2.5 bg-amber-50 border-t border-amber-200">
            <div className="w-full py-2 bg-amber-200 text-amber-500 text-xs font-semibold rounded-lg text-center">
              すべて回答してから更新
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 italic">↓ 確認事項に回答後、ラング解釈が更新されます</p>
        {mockRungs.map((r) => (
          <div key={r.number} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">RUNG {r.number}</span>
              <span className="text-xs text-blue-300">p.{r.page} 👁</span>
            </div>
            {r.warning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-amber-400 flex-shrink-0">⚠</span>
                <p className="text-xs text-amber-700">{r.warning}</p>
              </div>
            )}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <span className="text-gray-400 pt-1">入力</span>
              <div className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono text-gray-400">{r.inputs}</div>
              <span className="text-gray-400 pt-1">出力</span>
              <div className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono text-gray-400">{r.output}</div>
              <span className="text-gray-400 pt-1">メモ</span>
              <div className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-400">{r.comment}</div>
            </div>
          </div>
        ))}
        <div className="w-full py-2.5 bg-gray-200 text-gray-400 text-sm font-semibold rounded-xl text-center">
          変換表を生成 →
        </div>
      </div>
    </div>
  );
}

/* ── Step 3 モック：変換表 ── */
function MockConversionTableCard() {
  const mockTable = [
    { device: "X0", cVar: "input_start", type: "bool", desc: "起動スイッチ" },
    { device: "X1", cVar: "input_stop", type: "bool", desc: "停止スイッチ" },
    { device: "M100", cVar: "relay_motor_fwd", type: "bool", desc: "モーター正転フラグ" },
    { device: "Y0", cVar: "output_run", type: "bool", desc: "運転出力" },
    { device: "T0", cVar: "timer_delay", type: "uint16_t", desc: "遅延タイマー (100ms)" },
  ];

  return (
    <div
      className="flex flex-col rounded-2xl border-2 border-gray-200 bg-white w-[420px] opacity-60 select-none"
      style={{ maxHeight: "calc(100vh - 80px)" }}
      onWheel={(e) => e.stopPropagation()}
    >
      <MockHeader step={3} title="変換表" />
      <div className="p-4 space-y-3 overflow-y-auto">
        <p className="text-xs text-gray-400 italic">
          PLCデバイスとC変数の対応表です。各行を自由に編集できます。
        </p>
        <div className="grid grid-cols-[70px_1fr_80px_1fr] gap-1 px-1">
          {["デバイス", "C変数名", "型", "説明"].map((h) => (
            <span key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</span>
          ))}
        </div>
        {mockTable.map((row) => (
          <div key={row.device} className="grid grid-cols-[70px_1fr_80px_1fr] gap-1 items-center">
            <div className="border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-xs text-gray-400 bg-gray-50">{row.device}</div>
            <div className="border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-xs text-gray-400 bg-gray-50">{row.cVar}</div>
            <div className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-400 bg-gray-50">{row.type}</div>
            <div className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-400 bg-gray-50">{row.desc}</div>
          </div>
        ))}
        <div className="w-full py-2.5 bg-gray-200 text-gray-400 text-sm font-semibold rounded-xl text-center">
          Cコードを生成 →
        </div>
      </div>
    </div>
  );
}

/* ── Step 4 モック：コード生成 ── */
const MOCK_C_CODE = `/**
 * Auto-generated C code from PLC Ladder Diagram
 * Manufacturer: 三菱電機 (GX Works)
 */
#include <stdint.h>
#include <stdbool.h>

/* デバイス変数 */
bool input_start;     /* X0 起動スイッチ */
bool input_stop;      /* X1 停止スイッチ */
bool relay_motor_fwd; /* M100 モーター正転 */
bool output_run;      /* Y0 運転出力 */
uint16_t timer_delay; /* T0 遅延タイマー */

void plc_scan_cycle(void) {
  /* RUNG 1: 起動条件 */
  output_run = input_start && input_stop;

  /* RUNG 2: モーター正転 */
  if (relay_motor_fwd) output_motor_fwd = true;

  /* RUNG 3: タイマー制御 */
  output_timer = (timer_delay > 0) && !input_stop;
}`;

function MockCodeCard() {
  return (
    <div
      className="flex flex-col rounded-2xl border-2 border-gray-200 bg-white w-[480px] opacity-60 select-none"
      style={{ maxHeight: "calc(100vh - 80px)" }}
      onWheel={(e) => e.stopPropagation()}
    >
      <MockHeader step={4} title="コード生成" />
      <div className="flex flex-col h-full">
        <div className="flex border-b border-gray-100 px-4">
          <div className="px-4 py-2.5 text-sm font-medium border-b-2 border-blue-300 text-blue-400">C コード</div>
          <div className="px-4 py-2.5 text-sm font-medium text-gray-300">解釈ドキュメント</div>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <p className="text-xs text-gray-400 italic">
            変換表を確定すると、Cコードと解釈ドキュメントが生成されます。
          </p>
          <pre className="text-xs font-mono bg-gray-950 text-green-300/60 rounded-xl p-4 whitespace-pre overflow-x-auto">
            {MOCK_C_CODE}
          </pre>
          <div className="flex gap-2 justify-end">
            <div className="text-xs px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg">コピー</div>
            <div className="text-xs px-3 py-1.5 bg-blue-200 text-blue-400 rounded-lg">ダウンロード</div>
          </div>
        </div>
      </div>
    </div>
  );
}
