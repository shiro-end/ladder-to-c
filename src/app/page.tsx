import PdfUploader from "@/components/PdfUploader";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Ladder to C Converter</h1>
        <p className="text-gray-500 mt-2">
          PLCラダー図PDFをアップロードしてC言語コードに変換します。対応メーカー：三菱電機 / キーエンス
        </p>
      </header>
      <PdfUploader />
    </main>
  );
}
