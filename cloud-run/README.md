# Mealnote Gemma API

GitHub Pagesから受け取った画像またはレシピURLを、Vertex AI Model GardenのGemma 4で構造化するCloud Runサービスです。APIキーは使用せず、Cloud RunのサービスアカウントでVertex AIへ認証します。

## Google Cloud設定

1. 課金が有効なGoogle Cloudプロジェクトを用意します。
2. Cloud Run、Cloud Build、Artifact Registry、Vertex AI APIを有効化します。
3. Cloud Runの実行サービスアカウントへ `Vertex AI ユーザー` ロールを付与します。
4. Model Gardenで `Gemma 4 26B A4B IT API Service` を有効化します。
5. このディレクトリで次を実行します。

```sh
gcloud run deploy mealnote-gemma-api \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_LOCATION=global,ALLOWED_ORIGINS=https://th-auiwkn.github.io,RATE_LIMIT=20 \
  --max-instances 2 \
  --memory 512Mi \
  --timeout 120
```

デプロイ後に表示されたURLを、フロントエンドの `config.js` に設定します。
