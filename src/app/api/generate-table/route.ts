import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Rung, ConversionEntry } from "@/types/session";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { rungs, manufacturer } = (await req.json()) as {
      rungs: Rung[];
      manufacturer: string;
    };

    const manufacturerName =
      manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    const rungText = rungs
      .map(
        (r) =>
          `RUNG ${r.number}: 入力=${r.inputs} 出力=${r.output} コメント=${r.comment}`
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `以下は${manufacturerName}PLCのラダー図解析結果です。使用されているすべてのPLCデバイスを抽出し、C言語変数への対応表をJSON形式のみで返してください。

ラダー図:
${rungText}

出力形式:
{
  "conversionTable": [
    {
      "plcDevice": "X0",
      "cVariable": "input_start",
      "dataType": "bool",
      "description": "起動スイッチ"
    }
  ]
}

dataTypeは bool / uint16_t / uint32_t / int16_t のいずれかを使用してください。
JSONのみを返し、説明文は不要です。`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("レスポンスのJSON解析に失敗しました");

    const parsed = JSON.parse(match[0]) as {
      conversionTable: Omit<ConversionEntry, "id">[];
    };
    const conversionTable: ConversionEntry[] = parsed.conversionTable.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
    }));

    return NextResponse.json({ conversionTable });
  } catch (error) {
    const message = error instanceof Error ? error.message : "変換表生成エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
