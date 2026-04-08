# Ladder to C Converter

## プロジェクト概要
PLCのラダー図PDFをアップロードし、C言語コードに変換するWebアプリ。
社内ツールのため認証不要。精度重視。

## 技術スタック
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Anthropic Claude API / OpenAI API（Vision機能でラダー図解析）
- Supabase（セッション・プロジェクト管理DB、PDFページ画像ストレージ）
- Vercel（デプロイ先）

## インフラ・ツール
- **Vercel CLI** がインストール済み（`vercel` コマンドで操作可能）
  - デプロイ確認: `vercel ls`
  - ログ確認: `vercel logs <url>`
  - デプロイエラー調査は `npm run build` でローカル再現可能
- **Supabase** をDBとストレージに使用
  - `src/lib/supabase.ts` にクライアント初期化
  - `src/lib/db.ts` にDB操作関数
  - 環境変数: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Vercel 環境変数**（Settings → Environment Variables）
  - 設定済み: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - 要追加: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`（Supabase ダッシュボード → Project Settings → API で確認）

## アーキテクチャ
1. ユーザーがPDFをアップロード・LLMモデルを選択
2. `/api/parse-pdf` でPDFを画像変換 → Supabase Storage にアップロード
3. `/api/interpret` にページ画像をバッチ送信（5枚ずつ）
4. 選択モデルに応じてAnthropicまたはOpenAI SDKで解析
5. ラング・確認事項をセッションに保存
6. 変換表・Cコードを生成して表示・ダウンロード

## LLMモデル選択
Step1で以下の4モデルから選択可能：
- `claude-opus-4-6`（Anthropic）
- `claude-sonnet-4-6`（Anthropic）
- `gpt-4o`（OpenAI）
- `gpt-4o-mini`（OpenAI）

## 対応PLCメーカー
- 三菱電機（GX Works形式）
- キーエンス（KV Studio形式）

## 開発ルール
- 変換ロジックはすべて src/lib/ に集約
- APIキーは .env.local で管理
- 確認なしで git add → commit → push まで実行してよい
- デプロイエラーは `npm run build` でまず確認する
