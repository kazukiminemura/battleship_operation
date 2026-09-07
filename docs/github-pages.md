# GitHub Pagesへの公開

公開URL: https://kazukiminemura.github.io/battleship_operation/

GitHubの Settings → Pages → Source は **GitHub Actions** に設定します。
`main` へのpush時に `.github/workflows/deploy-pages.yml` がテストとビルドを実行し、
`dist` だけを公開します。Actions画面から手動実行も可能です。
ソースの `main / (root)` をそのまま公開する方式ではゲームは動作しません。

公開用ビルド・ローカル確認:

```sh
npm run build -- --mode pages
npm run preview -- --mode pages
```

確認URLは `http://localhost:4173/battleship_operation/` です。
`pages` モードでは画像・音声・スクリプトの参照先が `/battleship_operation/` 配下になります。
通常の `npm run dev` は従来通り `/` を使います。

Actionsの成功だけでなく、公開ページでタイトル→設計→出撃まで確認してください。
古い画面が残る場合は再読み込みしてください。
