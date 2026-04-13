import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ConversionEntry, ClarificationQuestion } from "@/types/session";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { cCode, conversionTable, clarifications, manufacturer } = (await req.json()) as {
      cCode: string;
      conversionTable: ConversionEntry[];
      clarifications?: ClarificationQuestion[];
      manufacturer: string;
    };

    const manufacturerName = manufacturer === "keyence" ? "キーエンス" : "三菱電機";

    const tableDesc = conversionTable
      .map((e) => `${e.plcDevice} → ${e.cVariable}: ${e.description}`)
      .join("\n");

    const answeredQA = (clarifications ?? []).filter((c) => c.answer.trim());
    const qaContext =
      answeredQA.length > 0
        ? `\n【設備担当者への確認事項と回答】\n` +
          answeredQA.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join("\n\n")
        : "";

    const prompt = `以下の${manufacturerName}PLC変換済みCコードについて、日本語の解釈ドキュメントを作成してください。${qaContext}

【デバイス対応（物理的意味）】
${tableDesc}

【生成されたCコード】
${cCode}

以下の構成でMarkdown形式のドキュメントを作成してください：
## プログラム概要
何を制御しているか（1〜2段落）

## 主要機能ブロック
起動シーケンス・インターロック・タイマー制御など機能単位で説明

## 安全回路・非常停止
安全に関わる回路の説明

## 特記事項
⚠マークのある箇所や、シミュレーションで要確認の実装

ラングを1件ずつ列挙せず、機能まとまりで説明してください。`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.choices[0]?.message?.content ?? "";

    return NextResponse.json({ interpretationDoc: text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ドキュメント生成エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
