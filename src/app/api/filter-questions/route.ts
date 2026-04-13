import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ClarificationQuestion } from "@/types/session";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let clarifications: ClarificationQuestion[] = [];
  try {
    const body = (await req.json()) as {
      clarifications: ClarificationQuestion[];
      manufacturer: string;
    };
    clarifications = body.clarifications;
    const { manufacturer } = body;

    if (clarifications.length === 0) {
      return NextResponse.json({ clarifications: [] });
    }

    const manufacturerName = manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    const qText = clarifications
      .map((c, i) => `[${i}] ${c.question}\n背景: ${c.context}`)
      .join("\n\n");

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `${manufacturerName}PLCラダー図の全ページ解析が完了しました。
以下の確認事項を整理し、重要度順に最大15件に絞ってください。

【残す基準】
- 設備・運用担当者にしか答えられない情報（通信仕様・物理デバイス種別・安全要件の意図など）
- C言語変換の品質に直接影響するもの

【除外・統合する基準】
- ラダー図の記述から推測できるもの
- C変換の品質に影響しないもの
- 類似・重複している質問（最も重要な1件に統合）

迷ったら除外してください。残すインデックス（0始まり）をJSONのみで返してください。

【確認事項】
${qText}

{"keep": [0, 2, 5]}`,
      }],
    });

    const text = res.choices[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ clarifications });

    const parsed = JSON.parse(match[0]) as { keep: number[] };
    const kept = clarifications.filter((_, i) => parsed.keep.includes(i));

    return NextResponse.json({ clarifications: kept });
  } catch (error) {
    console.error("filter-questions error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ clarifications }, { status: 500 });
  }
}
