import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/pdf-parser";
import { createAdminClient } from "@/lib/supabase";

export const maxDuration = 60;

const BUCKET = "pdf-pages";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFファイルが必要です" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "sessionIdが必要です" }, { status: 400 });
    }

    const pages = await parsePdf(file);
    const admin = createAdminClient();

    // バケットが存在しない場合は作成
    await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {/* already exists */});

    // 各ページをStorage にアップロード（並列）
    const uploadResults = await Promise.all(
      pages.map(async (page, i) => {
        const path = `${sessionId}/${i}.png`;
        const buffer = Buffer.from(page.base64, "base64");
        await admin.storage.from(BUCKET).upload(path, buffer, {
          contentType: "image/png",
          upsert: true,
        });
        const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
        return data.publicUrl;
      })
    );

    return NextResponse.json({
      pageUrls: uploadResults,
      pages: pages.map((p) => p.base64), // interpret バッチ用に引き続き返す
      pageCount: pages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF解析エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
