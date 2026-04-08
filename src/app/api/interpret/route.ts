import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parsePdf } from "@/lib/pdf-parser";
import type { Rung } from "@/types/session";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const manufacturer = (formData.get("manufacturer") as string) || "mitsubishi";

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFファイルが必要です" }, { status: 400 });
    }

    const pages = await parsePdf(file);
    const targetPages = pages.slice(0, 10);
    const manufacturerName =
      manufacturer === "keyence" ? "キーエンス（KV Studio形式）" : "三菱電機（GX Works形式）";

    const imageContent: Anthropic.ImageBlockParam[] = targetPages.map((p) => ({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: p.base64 },
    }));

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `これは${manufacturerName}のPLCラダー図です。すべてのラングを解析し、必ずJSON形式のみで返してください。説明文は不要です。

{
  "rungs": [
    {
      "number": 1,
      "pageNumber": 1,
      "inputs": "X0 AND X1",
      "output": "Y0 (OUT)",
      "comment": "起動条件",
      "warning": null
    }
  ]
}

warningには、下流の変換表・コード生成に大きく影響する場合（特殊命令・間接アドレッシング・ジャンプ命令など）のみ日本語で説明を入れてください。それ以外はnullにしてください。`,
            },
          ],
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("レスポンスのJSON解析に失敗しました");

    const parsed = JSON.parse(match[0]) as { rungs: Omit<Rung, "id">[] };
    const rungs: Rung[] = parsed.rungs.map((r) => ({ ...r, id: crypto.randomUUID() }));

    // ページ画像も返す（クライアントで sessionStorage に保存）
    const pageImages = targetPages.map((p) => p.base64);

    return NextResponse.json({ rungs, pages: pageImages, pageCount: pages.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
