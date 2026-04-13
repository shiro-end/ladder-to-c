import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { Rung, ClarificationQuestion } from "@/types/session";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { rungs, clarifications, manufacturer } = (await req.json()) as {
      rungs: Rung[];
      clarifications: ClarificationQuestion[];
      manufacturer: string;
    };

    const manufacturerName =
      manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    const rungText = rungs
      .map((r) => `RUNG ${r.number} (p.${r.pageNumber}): 入力=${r.inputs} 出力=${r.output} コメント=${r.comment}`)
      .join("\n");

    const qaText = clarifications
      .filter((c) => c.answer.trim())
      .map((c) => `Q: ${c.question}\n背景: ${c.context}\nA: ${c.answer}`)
      .join("\n\n");

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `${manufacturerName}PLCのラダー図解釈に、以下の確認事項への回答が得られました。
回答を踏まえてラング解釈を更新してください。JSONのみ返してください。

【現在のラング解釈】
${rungText}

【確認事項と回答】
${qaText}

回答を反映して comment と warning を更新したラングリストを返してください。
inputs・output・number・pageNumber は変更しないでください。

{
  "rungs": [
    {
      "number": 1,
      "pageNumber": 1,
      "inputs": "...",
      "output": "...",
      "comment": "回答を踏まえた説明",
      "warning": null
    }
  ]
}`,
      }],
    });

    const text = res.choices[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("レスポンスのJSON解析に失敗しました");

    const parsed = JSON.parse(match[0]) as { rungs: Omit<Rung, "id">[] };

    const idMap = Object.fromEntries(rungs.map((r) => [r.number, r.id]));
    const updatedRungs: Rung[] = parsed.rungs.map((r) => ({
      ...r,
      id: idMap[r.number] ?? crypto.randomUUID(),
    }));

    return NextResponse.json({ rungs: updatedRungs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解釈更新エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
