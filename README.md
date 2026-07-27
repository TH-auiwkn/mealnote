# Mealnote

レシピ・献立・買い物を管理するWebアプリです。

写真のOCRに加え、公開されているレシピページのURLから材料と作り方を取り込めます。

## Gemma 4によるレシピ抽出

画像とWebページ本文の解析には `gemma-4-26b-a4b-it` を使用できます。アプリ内の「Gemma 4の設定」から、[Google AI Studio](https://aistudio.google.com/app/apikey)で発行したAPIキーを入力してください。

- APIキーはリポジトリには保存されません。
- 「この端末に保存する」を選ばない場合、キーはブラウザのタブを閉じるまでだけ保持されます。
- 画像はGoogle Gemini APIへ送信されます。
- URL取り込みでは、URLをJina Readerへ、取得したページ本文をGoogle Gemini APIへ送信します。
- Gemma 4で失敗した場合は、端末内OCRまたは従来のURL解析へ切り替えられます。

## 公開ページ

[https://th-auiwkn.github.io/mealnote/](https://th-auiwkn.github.io/mealnote/)
