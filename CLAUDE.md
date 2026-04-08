# Ladder to C Converter

## プロジェクト概要
PLCのラダー図PDFをアップロードし、C言語コードに変換するWebアプリ。
社内ツールのため認証不要。精度重視。

## 技術スタック
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Anthropic Claude API（Vision機能でラダー図解析）
- Vercel（デプロイ先）

## アーキテクチャ
1. ユーザーがPDFをアップロード
2. PDFを画像に変換（pdf-to-img等）
3. Claude Vision APIに画像を渡して解析
4. ラダー図の回路構造を認識（三菱・キーエンス対応）
5. C言語コードを生成して表示・ダウンロード

## ディレクトリ構成
src/
├── app/
│   ├── page.tsx          # メイン画面（PDF Upload UI）
│   └── api/
│       └── convert/
│           └── route.ts  # 変換APIエンドポイント
├── lib/
│   ├── pdf-parser.ts     # PDF→画像変換
│   ├── claude-vision.ts  # Claude API呼び出し
│   └── c-generator.ts    # C言語コード生成
└── components/
    ├── PdfUploader.tsx   # アップロードUI
    └── CodeViewer.tsx    # 生成コード表示

## 対応PLCメーカー
- 三菱電機（GX Works形式）
- キーエンス（KV Studio形式）

## 開発ルール
- 変換ロジックはすべて src/lib/ に集約
- APIキーは .env.local で管理（ANTHROPIC_API_KEY）
- コミット前に npm run lint を実行
- 確認なしで git add → commit → push まで実行してよい
