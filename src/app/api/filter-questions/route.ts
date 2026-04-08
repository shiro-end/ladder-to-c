import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Rung, ClarificationQuestion } from "@/types/session";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let clarifications: ClarificationQuestion[] = [];
  try {
    const body = (await req.json()) as {
      rungs: Rung[];
      clarifications: ClarificationQuestion[];
      manufacturer: string;
    };
    const { rungs, manufacturer } = body;
    clarifications = body.clarifications;

    if (clarifications.length === 0) {
      return NextResponse.json({ clarifications: [] });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const manufacturerName = manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    const rungText = rungs
      .map((r) => `RUNG ${r.number} (p.${r.pageNumber}): 入力=${r.inputs} 出力=${r.output} コメント=${r.comment}`)
      .join("\n");

    const qText = clarifications
      .map((c, i) => `[${i}] ${c.question}\n背景: ${c.context}`)
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `${manufacturerName}PLCラダー図の全ページ解析が完了しました。
以下の確認事項のうち、全ページのラング解釈から答えが明らかに推測できるものを除外し、
まだ不明な質問のインデックス（0始まり）だけをJSON配列で返してください。
判断が難しい場合は残してください。JSONのみ返してください。

【ラング解釈（全ページ）】
${rungText}

【確認事項】
${qText}

{"keep": [0, 1]}`,
      }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
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
