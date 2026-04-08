import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import type { Rung, ConversionEntry } from "@/types/session";

export const maxDuration = 120;

const BATCH_SIZE = 60;

async function extractDevicesFromBatch(
  anthropic: Anthropic,
  rungs: Rung[],
  manufacturerName: string,
): Promise<Omit<ConversionEntry, "id">[]> {
  const rungText = rungs
    .map((r) => `RUNG ${r.number}: 入力=${r.inputs} 出力=${r.output} コメント=${r.comment}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `以下は${manufacturerName}PLCのラダー図解析結果（一部）です。
使用されているPLCデバイスを抽出し、C言語変数への対応表をJSONのみで返してください。

ラダー図:
${rungText}

{"conversionTable": [{"plcDevice": "X0", "cVariable": "input_start", "dataType": "bool", "description": "起動スイッチ"}]}

dataTypeは bool / uint16_t / uint32_t / int16_t のいずれか。JSONのみ返してください。`,
    }],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];

  let parsed: { conversionTable: Omit<ConversionEntry, "id">[] };
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    parsed = JSON.parse(jsonrepair(match[0]));
  }
  return parsed.conversionTable ?? [];
}

export async function POST(req: NextRequest) {
  try {
    const { rungs, manufacturer } = (await req.json()) as {
      rungs: Rung[];
      manufacturer: string;
    };

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const manufacturerName = manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    // バッチ分割して並列処理
    const batches: Rung[][] = [];
    for (let i = 0; i < rungs.length; i += BATCH_SIZE) {
      batches.push(rungs.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(
      batches.map((batch) => extractDevicesFromBatch(anthropic, batch, manufacturerName))
    );

    // デバイス名で重複排除してマージ
    const seen = new Set<string>();
    const merged: Omit<ConversionEntry, "id">[] = [];
    for (const entries of batchResults) {
      for (const entry of entries) {
        if (!seen.has(entry.plcDevice)) {
          seen.add(entry.plcDevice);
          merged.push(entry);
        }
      }
    }

    // PLCデバイス名でソート（X→Y→M→T→C→D→R の順）
    const order = ["X", "Y", "M", "T", "C", "D", "R"];
    merged.sort((a, b) => {
      const ai = order.findIndex((p) => a.plcDevice.startsWith(p));
      const bi = order.findIndex((p) => b.plcDevice.startsWith(p));
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.plcDevice.localeCompare(b.plcDevice, undefined, { numeric: true });
    });

    const conversionTable: ConversionEntry[] = merged.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
    }));

    return NextResponse.json({ conversionTable });
  } catch (error) {
    const message = error instanceof Error ? error.message : "変換表生成エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
