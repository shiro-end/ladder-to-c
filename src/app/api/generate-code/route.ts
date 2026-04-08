import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Rung, ConversionEntry } from "@/types/session";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { rungs, conversionTable, manufacturer } = (await req.json()) as {
      rungs: Rung[];
      conversionTable: ConversionEntry[];
      manufacturer: string;
    };

    const manufacturerName =
      manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    const rungText = rungs
      .map(
        (r) =>
          `RUNG ${r.number} (p.${r.pageNumber}): 入力=${r.inputs} 出力=${r.output} コメント=${r.comment}`
      )
      .join("\n");

    const tableText = conversionTable
      .map(
        (e) =>
          `${e.plcDevice} → ${e.cVariable} (${e.dataType}) // ${e.description}`
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `${manufacturerName}PLCのラダー図をC言語に変換してください。

【ラダー図】
${rungText}

【デバイス対応表】
${tableText}

以下の2つをJSON形式で返してください。JSONのみを返し、説明文は不要です。

{
  "cCode": "/* C言語コード全文 */",
  "interpretationDoc": "## ラダー図解釈ドキュメント\\n\\n各ラングの動作説明..."
}

cCodeの要件:
- ヘッダーコメントにメーカー名・日付を含める
- デバイス対応表の変数名を使用する
- 各ラングをコメント付きで実装する
- void plc_scan_cycle(void) 関数内にまとめる
- bool型はstdbool.hを使用する

interpretationDocの要件:
- Markdown形式
- 各ラングの動作を日本語で説明
- 特記事項（タイマー・カウンターなど）を明記`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("レスポンスのJSON解析に失敗しました");

    const parsed = JSON.parse(match[0]) as {
      cCode: string;
      interpretationDoc: string;
    };

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "コード生成エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
