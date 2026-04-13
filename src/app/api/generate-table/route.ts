import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import type { Rung, ConversionEntry } from "@/types/session";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { rungs, manufacturer } = (await req.json()) as {
      rungs: Rung[];
      manufacturer: string;
    };

    const manufacturerName = manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    const rungText = rungs
      .map((r) => `RUNG ${r.number}: 入力=${r.inputs} 出力=${r.output} コメント=${r.comment}`)
      .join("\n");

    const prompt = `以下は${manufacturerName}PLCのラダー図解析結果（一部）です。
使用されているPLCデバイスを抽出し、C言語変数への対応表をJSONのみで返してください。

ラダー図:
${rungText}

{"entries": [{"plcDevice": "X0", "cVariable": "input_start", "dataType": "bool", "description": "起動スイッチ"}]}

dataTypeは bool / uint16_t / uint32_t / int16_t のいずれか。JSONのみ返してください。`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.choices[0]?.message?.content ?? "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("レスポンスのJSON解析に失敗しました");

    let parsed: { entries: Omit<ConversionEntry, "id">[] };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      parsed = JSON.parse(jsonrepair(match[0]));
    }

    const entries: ConversionEntry[] = (parsed.entries ?? []).map((e) => ({
      ...e,
      id: crypto.randomUUID(),
    }));

    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "変換表生成エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
