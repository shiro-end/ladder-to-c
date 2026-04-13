import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import type { Rung, ConversionEntry } from "@/types/session";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { rungs, conversionTable, manufacturer } = (await req.json()) as {
      rungs: Rung[];
      conversionTable: ConversionEntry[];
      manufacturer: string;
    };

    const manufacturerName = manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    const rungText = rungs
      .map((r) => `RUNG ${r.number}: 入力=${r.inputs} 出力=${r.output} コメント=${r.comment}`)
      .join("\n");

    const tableText = conversionTable
      .map((e) => `${e.plcDevice} → ${e.cVariable} (${e.dataType})`)
      .join("\n");

    const prompt = `${manufacturerName}PLCのラダー図をCコードに変換します。

【デバイス対応表】
${tableText}

【ラング】
${rungText}

各ラングのCコードスニペットをJSON配列で返してください。
- ヘッダーや宣言は不要。if文・代入文のみ
- タイマー・カウンター・データ操作など不確かな命令は ⚠ コメントを入れる
- 完全再現でなくてよい。意図が伝わるコードを優先

[{"rungNumber": 1, "cSnippet": "/* コメント */\\nif (x0 && m100) { y0 = true; }"}]

JSONのみ返してください。`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.choices[0]?.message?.content ?? "";

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("レスポンスのJSON解析に失敗しました");

    let parsed: { rungNumber: number; cSnippet: string }[];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      parsed = JSON.parse(jsonrepair(match[0]));
    }

    return NextResponse.json({ snippets: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "コード生成エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
