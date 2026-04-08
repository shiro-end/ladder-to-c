/**
 * PDF → Base64画像変換
 * pdf-to-img ライブラリを使用してPDFの各ページを画像に変換する
 */

export interface PdfPage {
  /** Base64エンコードされたPNG画像データ */
  base64: string;
  /** ページ番号（1始まり） */
  pageNumber: number;
}

/**
 * アップロードされたPDFファイルを画像配列に変換する
 */
export async function parsePdf(file: File): Promise<PdfPage[]> {
  const { pdf } = await import("pdf-to-img");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const pages: PdfPage[] = [];
  let pageNumber = 1;

  for await (const page of await pdf(buffer, { scale: 2 })) {
    // page は PNG の Buffer
    const base64 = page.toString("base64");
    pages.push({ base64, pageNumber });
    pageNumber++;
  }

  if (pages.length === 0) {
    throw new Error("PDFからページを読み取れませんでした");
  }

  return pages;
}
