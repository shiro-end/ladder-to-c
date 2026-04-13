import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import type { Rung, ClarificationQuestion } from "@/types/session";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { pages, previousRungs, manufacturer, batchInfo } = (await req.json()) as {
      pages: string[];
      previousRungs: Rung[];
      manufacturer: string;
      batchInfo: { current: number; total: number; pageStart: number; pageEnd: number };
    };

    const manufacturerName =
      manufacturer === "keyence" ? "キーエンス（KV Studio形式）" : "三菱電機（GX Works形式）";

    const previousContext =
      previousRungs.length > 0
        ? `\n【前ページまでの解析済みラング（参照用）】\n` +
          previousRungs
            .map((r) => `RUNG ${r.number} (p.${r.pageNumber}): 入力=${r.inputs} 出力=${r.output}`)
            .join("\n")
        : "";

    const promptText = `これは${manufacturerName}のPLCラダー図です。
表示されているページ（p.${batchInfo.pageStart}〜p.${batchInfo.pageEnd}）のすべてのラングを解析してください。
全体の ${batchInfo.total} バッチ中 ${batchInfo.current} バッチ目です。${previousContext}

JSONのみで返してください（説明文不要）：

{
  "rungs": [
    {
      "number": 1,
      "pageNumber": ${batchInfo.pageStart},
      "inputs": "X0 AND X1",
      "output": "Y0 (OUT)",
      "comment": "起動条件",
      "warning": null
    }
  ],
  "clarifications": [
    {
      "question": "R39001はHMIボタンですか？物理スイッチですか？",
      "context": "操作場所によって制御フローの説明が変わります"
    }
  ]
}

- number は前バッチの続きから採番してください（最後のラング番号は ${previousRungs.length > 0 ? previousRungs[previousRungs.length - 1].number : 0}）
- warning は下流に大きく影響する場合のみ記載、それ以外は null
- clarifications: ラダー図を見ても分からない、設備担当者にしか答えられない情報のみ質問する
  （例：デバイスの物理種別・外部通信仕様・安全要件の意図・HMIか物理スイッチかの区別）
  ラダー図の記述から読み取れること・推測できることは絶対に質問しない。
  前バッチで既出の質問は除外する。該当がなければ空配列でよい。`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: [
          ...pages.map((base64) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${base64}` },
          })),
          { type: "text" as const, text: promptText },
        ],
      }],
    });
    const text = response.choices[0]?.message?.content ?? "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("レスポンスのJSON解析に失敗しました");

    type ParsedResponse = {
      rungs: Omit<Rung, "id">[];
      clarifications: Omit<ClarificationQuestion, "id" | "answer">[];
    };

    let parsed: ParsedResponse;
    try {
      parsed = JSON.parse(match[0]) as ParsedResponse;
    } catch {
      try {
        parsed = JSON.parse(jsonrepair(match[0])) as ParsedResponse;
      } catch {
        throw new Error("JSONの解析に失敗しました（修復不可）");
      }
    }

    const rungs: Rung[] = (parsed.rungs ?? []).map((r) => ({ ...r, id: crypto.randomUUID() }));
    const clarifications: ClarificationQuestion[] = (parsed.clarifications ?? []).map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      answer: "",
    }));

    return NextResponse.json({ rungs, clarifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析エラー";
    const isRateLimit =
      message.includes("429") ||
      message.toLowerCase().includes("rate limit") ||
      message.toLowerCase().includes("rate_limit");
    return NextResponse.json({ error: message }, { status: isRateLimit ? 429 : 500 });
  }
}
