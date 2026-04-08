"use client";

import { useState, useEffect, useRef, RefObject } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

/** カード内スクロール領域でズームを阻止するネイティブリスナー */
function useBlockCanvasZoom(ref: RefObject<HTMLDivElement | null>) {
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
import Step1Upload from "./steps/Step1Upload";
import Step2Interpretation from "./steps/Step2Interpretation";
import Step3ConversionTable from "./steps/Step3ConversionTable";
import Step4Generate from "./steps/Step4Generate";
import PdfPreviewPanel from "./PdfPreviewPanel";
import type { Session, Rung, ConversionEntry, Project } from "@/types/session";

interface Props {
  session: Session | null;
  projects: Project[];
  onSessionUpdate: (updates: Partial<Session>) => void;
  onSessionCreate: (updates: Partial<Session> & { id: string }, pageUrls: string[]) => void;
  onProjectsChange: () => void;
}

export default function Canvas({ session, projects, onSessionUpdate, onSessionCreate, onProjectsChange }: Props) {
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
              contentStyle={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start", gap: "20px", padding: "40px", width: "max-content" }}
            >
              {/* Step 1 */}
              <Step1Upload
                session={session}
                projects={projects}
                isFocused={focusedStep === 1}
                onToggleFocus={() => toggleFocus(1)}
                onComplete={(updates, pages) => onSessionCreate(updates, pages)}
                onSessionUpdate={onSessionUpdate}
                onProjectsChange={onProjectsChange}
                onEdit={session ? () => onSessionUpdate({ activeStep: 1 }) : undefined}
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
                  onEdit={() => onSessionUpdate({ activeStep: 2 })}
                  onModelChange={(model) => onSessionUpdate({ model })}
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
                  onComplete={() => onSessionUpdate({ activeStep: 4 })}
                  onEdit={() => onSessionUpdate({ activeStep: 3 })}
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
                  onComplete={(cCode, interpretationDoc) =>
                    onSessionUpdate({ cCode, interpretationDoc })
                  }
                  onModelChange={(model) => onSessionUpdate({ model })}
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
          pages={session?.pdfPageUrls ?? []}
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

/* ── モックカード共通：スクロール可能ラッパー ── */
function MockScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useBlockCanvasZoom(ref);
  return (
    <div ref={ref} className={`overflow-y-auto min-h-0 ${className ?? ""}`}>
      {children}
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
    { number: 1,  page: 1, inputs: "X0 AND X1",               output: "Y0 (OUT)",   comment: "起動条件",                  warning: null },
    { number: 2,  page: 1, inputs: "M100",                     output: "Y1 (SET)",   comment: "モーター正転セット",         warning: "M100は変換表に影響します" },
    { number: 3,  page: 2, inputs: "T0 AND NOT X5",            output: "Y2 (OUT)",   comment: "タイマー制御出力",          warning: null },
    { number: 4,  page: 2, inputs: "X2 OR M200",               output: "Y3 (OUT)",   comment: "非常停止または内部フラグ",  warning: null },
    { number: 5,  page: 2, inputs: "NOT X3",                   output: "M201 (OUT)", comment: "センサー未検出フラグ",      warning: null },
    { number: 6,  page: 3, inputs: "M201 AND T1",              output: "Y4 (SET)",   comment: "遅延後アラーム出力",        warning: "T1のプリセット値要確認" },
    { number: 7,  page: 3, inputs: "X4",                       output: "T0 (TMR)",   comment: "タイマーT0起動 (1.0s)",    warning: null },
    { number: 8,  page: 3, inputs: "X5",                       output: "T1 (TMR)",   comment: "タイマーT1起動 (0.5s)",    warning: null },
    { number: 9,  page: 4, inputs: "C0 AND M100",              output: "Y5 (OUT)",   comment: "カウント完了かつ正転中",   warning: null },
    { number: 10, page: 4, inputs: "X6",                       output: "C0 (CNT)",   comment: "カウンターC0インクリメント", warning: null },
    { number: 11, page: 4, inputs: "M100 AND NOT M201",        output: "Y6 (OUT)",   comment: "正転中かつ正常時の補助出力", warning: null },
    { number: 12, page: 5, inputs: "D100 >= K50",              output: "M300 (OUT)", comment: "データレジスタ閾値超え検出", warning: "D100の更新元ラダーを確認" },
    { number: 13, page: 5, inputs: "M300",                     output: "Y7 (SET)",   comment: "閾値超えアラーム出力",     warning: null },
    { number: 14, page: 5, inputs: "X7 AND NOT M300",          output: "Y10 (OUT)",  comment: "手動復帰条件",             warning: null },
    { number: 15, page: 6, inputs: "M100 OR M201 OR M300",     output: "Y11 (OUT)",  comment: "いずれかのフラグで表示灯点灯", warning: null },
  ];

  return (
    <div
      className="flex flex-col rounded-2xl border-2 border-gray-200 bg-white w-[480px] select-none"
      style={{ maxHeight: "calc((100vh - 80px) * 2)" }}
    >
      <MockHeader step={2} title="ラダー図の解釈" />
      <MockScrollArea className="p-4 space-y-4">

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
      </MockScrollArea>
    </div>
  );
}

/* ── Step 3 モック：変換表 ── */
function MockConversionTableCard() {
  const mockTable = [
    { device: "X0",   cVar: "input_start",         type: "bool",     desc: "起動スイッチ" },
    { device: "X1",   cVar: "input_stop",           type: "bool",     desc: "停止スイッチ" },
    { device: "X2",   cVar: "input_estop",          type: "bool",     desc: "非常停止ボタン" },
    { device: "X3",   cVar: "input_sensor_a",       type: "bool",     desc: "センサーA検出" },
    { device: "X4",   cVar: "input_timer_start",    type: "bool",     desc: "タイマー起動入力" },
    { device: "X5",   cVar: "input_timer_stop",     type: "bool",     desc: "タイマー停止入力" },
    { device: "X6",   cVar: "input_counter_pulse",  type: "bool",     desc: "カウンターパルス入力" },
    { device: "X7",   cVar: "input_manual_reset",   type: "bool",     desc: "手動復帰ボタン" },
    { device: "Y0",   cVar: "output_run",           type: "bool",     desc: "運転出力" },
    { device: "Y1",   cVar: "output_motor_fwd",     type: "bool",     desc: "モーター正転出力" },
    { device: "Y2",   cVar: "output_timer_out",     type: "bool",     desc: "タイマー出力" },
    { device: "Y3",   cVar: "output_estop_relay",   type: "bool",     desc: "非常停止リレー" },
    { device: "Y4",   cVar: "output_alarm",         type: "bool",     desc: "アラーム出力" },
    { device: "Y5",   cVar: "output_count_done",    type: "bool",     desc: "カウント完了出力" },
    { device: "Y6",   cVar: "output_aux",           type: "bool",     desc: "補助出力" },
    { device: "Y7",   cVar: "output_alarm_latch",   type: "bool",     desc: "アラームラッチ出力" },
    { device: "Y10",  cVar: "output_manual_run",    type: "bool",     desc: "手動運転出力" },
    { device: "Y11",  cVar: "output_indicator",     type: "bool",     desc: "表示灯" },
    { device: "M100", cVar: "relay_motor_fwd",      type: "bool",     desc: "モーター正転フラグ" },
    { device: "M200", cVar: "relay_estop_flag",     type: "bool",     desc: "非常停止内部フラグ" },
    { device: "M201", cVar: "relay_sensor_off",     type: "bool",     desc: "センサー未検出フラグ" },
    { device: "M300", cVar: "relay_threshold_over", type: "bool",     desc: "閾値超えフラグ" },
    { device: "T0",   cVar: "timer_delay_1s",       type: "uint16_t", desc: "遅延タイマー 1.0s" },
    { device: "T1",   cVar: "timer_delay_500ms",    type: "uint16_t", desc: "遅延タイマー 0.5s" },
    { device: "C0",   cVar: "counter_main",         type: "uint16_t", desc: "メインカウンター" },
    { device: "D100", cVar: "data_sensor_value",    type: "int16_t",  desc: "センサーアナログ値" },
  ];

  return (
    <div
      className="flex flex-col rounded-2xl border-2 border-gray-200 bg-white w-[420px] opacity-60 select-none"
      style={{ maxHeight: "calc((100vh - 80px) * 2)" }}
    >
      <MockHeader step={3} title="変換表" />
      <MockScrollArea className="p-4 space-y-3">
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
      </MockScrollArea>
    </div>
  );
}

/* ── Step 4 モック：コード生成 ── */
const MOCK_C_CODE = `/**
 * Auto-generated C code from PLC Ladder Diagram
 * Manufacturer: 三菱電機 (GX Works)
 * Generated by Ladder to C Converter
 */

#include <stdint.h>
#include <stdbool.h>

/* ── 入力デバイス ── */
bool input_start;          /* X0  起動スイッチ */
bool input_stop;           /* X1  停止スイッチ */
bool input_estop;          /* X2  非常停止ボタン */
bool input_sensor_a;       /* X3  センサーA検出 */
bool input_timer_start;    /* X4  タイマー起動入力 */
bool input_timer_stop;     /* X5  タイマー停止入力 */
bool input_counter_pulse;  /* X6  カウンターパルス入力 */
bool input_manual_reset;   /* X7  手動復帰ボタン */

/* ── 出力デバイス ── */
bool output_run;           /* Y0  運転出力 */
bool output_motor_fwd;     /* Y1  モーター正転出力 */
bool output_timer_out;     /* Y2  タイマー出力 */
bool output_estop_relay;   /* Y3  非常停止リレー */
bool output_alarm;         /* Y4  アラーム出力 */
bool output_count_done;    /* Y5  カウント完了出力 */
bool output_aux;           /* Y6  補助出力 */
bool output_alarm_latch;   /* Y7  アラームラッチ出力 */
bool output_manual_run;    /* Y10 手動運転出力 */
bool output_indicator;     /* Y11 表示灯 */

/* ── 内部リレー ── */
bool relay_motor_fwd;      /* M100 モーター正転フラグ */
bool relay_estop_flag;     /* M200 非常停止内部フラグ */
bool relay_sensor_off;     /* M201 センサー未検出フラグ */
bool relay_threshold_over; /* M300 閾値超えフラグ */

/* ── タイマー・カウンター ── */
uint16_t timer_delay_1s;   /* T0 遅延タイマー 1.0s */
uint16_t timer_delay_500ms;/* T1 遅延タイマー 0.5s */
uint16_t counter_main;     /* C0 メインカウンター */

/* ── データレジスタ ── */
int16_t data_sensor_value; /* D100 センサーアナログ値 */

void plc_scan_cycle(void) {

  /* RUNG 1: 起動条件 */
  output_run = input_start && input_stop;

  /* RUNG 2: モーター正転セット */
  if (relay_motor_fwd) output_motor_fwd = true;

  /* RUNG 3: タイマー制御出力 */
  output_timer_out = (timer_delay_1s > 0) && !input_timer_stop;

  /* RUNG 4: 非常停止または内部フラグ */
  output_estop_relay = input_estop || relay_estop_flag;

  /* RUNG 5: センサー未検出フラグ */
  relay_sensor_off = !input_sensor_a;

  /* RUNG 6: 遅延後アラーム出力 */
  /* ※ T1のプリセット値要確認 */
  if (relay_sensor_off && (timer_delay_500ms >= T1_PRESET)) {
    output_alarm = true;
  }

  /* RUNG 7: タイマーT0起動 (1.0s) */
  if (input_timer_start) timer_delay_1s++;
  else timer_delay_1s = 0;

  /* RUNG 8: タイマーT1起動 (0.5s) */
  if (input_timer_stop) timer_delay_500ms++;
  else timer_delay_500ms = 0;

  /* RUNG 9: カウント完了かつ正転中 */
  output_count_done = (counter_main >= C0_PRESET) && relay_motor_fwd;

  /* RUNG 10: カウンターC0インクリメント */
  if (input_counter_pulse) counter_main++;

  /* RUNG 11: 正転中かつ正常時の補助出力 */
  output_aux = relay_motor_fwd && !relay_sensor_off;

  /* RUNG 12: データレジスタ閾値超え検出 */
  /* ※ D100の更新元ラダーを確認 */
  relay_threshold_over = (data_sensor_value >= 50);

  /* RUNG 13: 閾値超えアラームラッチ */
  if (relay_threshold_over) output_alarm_latch = true;

  /* RUNG 14: 手動復帰条件 */
  output_manual_run = input_manual_reset && !relay_threshold_over;

  /* RUNG 15: 状態表示灯 */
  output_indicator = relay_motor_fwd || relay_sensor_off || relay_threshold_over;
}`;

function MockCodeCard() {
  return (
    <div
      className="flex flex-col rounded-2xl border-2 border-gray-200 bg-white w-[480px] opacity-60 select-none"
      style={{ maxHeight: "calc((100vh - 80px) * 2)" }}
    >
      <MockHeader step={4} title="コード生成" />
      <div className="flex flex-col h-full">
        <div className="flex border-b border-gray-100 px-4">
          <div className="px-4 py-2.5 text-sm font-medium border-b-2 border-blue-300 text-blue-400">C コード</div>
          <div className="px-4 py-2.5 text-sm font-medium text-gray-300">解釈ドキュメント</div>
        </div>
        <MockScrollArea className="p-4 space-y-3 flex-1">
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
        </MockScrollArea>
      </div>
    </div>
  );
}
