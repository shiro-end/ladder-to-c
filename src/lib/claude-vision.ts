/**
 * Claude Vision API を使ったラダー図解析
 */
import Anthropic from "@anthropic-ai/sdk";
import type { PdfPage } from "./pdf-parser";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type Manufacturer = "mitsubishi" | "keyence";

export interface LadderStructure {
  /** 解析結果の生テキスト（Claude の応答） */
  rawAnalysis: string;
  /** ページ数 */
  pageCount: number;
  /** 対応メーカー */
  manufacturer: Manufacturer;
}

function buildSystemPrompt(manufacturer: Manufacturer): string {
  const manufacturerName =
    manufacturer === "mitsubishi" ? "三菱電機（GX Works形式）" : "キーエンス（KV Studio形式）";

  return `あなたはPLCラダー図の専門家です。${manufacturerName}のラダー図画像を解析し、
回路構造を正確に把握してください。

以下の要素を識別してください：
- 接点（常開接点 -| |-、常閉接点 -|/|-）
- コイル（出力コイル -( )-、セットコイル -(S)-、リセットコイル -(R)-）
- タイマー（T）、カウンター（C）
- 演算命令（MOV、ADD、SUB等）
- ファンクションブロック
- ラング番号とコメント

解析結果は構造化されたテキストで返してください。`;
}

function buildUserPrompt(manufacturer: Manufacturer): string {
  const manufacturerName =
    manufacturer === "mitsubishi" ? "三菱電機" : "キーエンス";

  return `これは${manufacturerName}PLCのラダー図です。
各ラングの回路構造を詳細に解析し、以下の形式で出力してください：

RUNG [番号]:
  入力条件: [接点の論理構造]
  出力: [コイル/命令]
  コメント: [ラングの説明]

すべてのラングを漏れなく解析してください。`;
}

/**
 * PDFページ画像をClaude Vision APIに渡してラダー図を解析する
 */
export async function analyzeWithClaude(
  pages: PdfPage[],
  manufacturer: string
): Promise<LadderStructure> {
  const mfr = (manufacturer === "keyence" ? "keyence" : "mitsubishi") as Manufacturer;

  // 最大10ページまで送信（トークン制限対策）
  const targetPages = pages.slice(0, 10);

  const imageContent: Anthropic.ImageBlockParam[] = targetPages.map((page) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/png",
      data: page.base64,
    },
  }));

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    system: buildSystemPrompt(mfr),
    messages: [
      {
        role: "user",
        content: [
          ...imageContent,
          {
            type: "text",
            text: buildUserPrompt(mfr),
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claudeからの応答が空でした");
  }

  return {
    rawAnalysis: textBlock.text,
    pageCount: pages.length,
    manufacturer: mfr,
  };
}
