import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/pdf-parser";
import { analyzeWithClaude } from "@/lib/claude-vision";
import { generateCCode } from "@/lib/c-generator";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const manufacturer = (formData.get("manufacturer") as string) || "mitsubishi";

    if (!file) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFファイルのみ対応しています" }, { status: 400 });
    }

    // PDF → 画像変換
    const images = await parsePdf(file);

    // Claude Vision でラダー図解析
    const ladderStructure = await analyzeWithClaude(images, manufacturer);

    // C言語コード生成
    const cCode = generateCCode(ladderStructure, manufacturer);

    return NextResponse.json({ code: cCode });
  } catch (error) {
    console.error("変換エラー:", error);
    const message = error instanceof Error ? error.message : "変換中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
