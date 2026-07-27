# Mealnote

レシピ・献立・買い物を管理するWebアプリです。

レシピ画像と、公開されているレシピページのURLから材料と作り方を取り込めます。

- 材料は「なし」または（A）〜（H）のグループに分けて登録できます。
- 画像・URL取り込みでも、元レシピの（A）（B）などの材料グループを保持します。

## Gemma 4によるレシピ抽出

画像とWebページ本文の解析には、Vertex AI の `google/gemma-4-26b-a4b-it-maas` を使用します。ブラウザから直接AIへ接続せず、Cloud Run APIを経由するため、利用者によるAPIキーの入力は不要です。

- 画像はCloud RunからVertex AIへ送信され、保存は行いません。
- URL取り込みではCloud RunがJina Readerから公開ページ本文を取得し、Vertex AIで解析します。
- APIはGitHub Pagesの公開元だけを許可し、10分あたり20回の簡易レート制限を設けています。

## 構成

- フロントエンド: GitHub Pages
- 解析API: Cloud Run（`asia-northeast1`）
- AI: Vertex AI / Gemma 4（`global`）

Cloud Run API: [https://mealnote-gemma-api-566800309858.asia-northeast1.run.app](https://mealnote-gemma-api-566800309858.asia-northeast1.run.app)

## 公開ページ

[https://th-auiwkn.github.io/mealnote/](https://th-auiwkn.github.io/mealnote/)
