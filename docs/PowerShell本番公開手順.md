# PowerShellからの本番公開手順

対象Firebaseプロジェクトは `hanahuda-adf91`、対象GitHubリポジトリは `https://github.com/matsuokakoki/hanahuda.git` です。

この手順はDockerを使いません。Windows PCにあるGit、Node.js、npm、Firebase CLIを使います。

## 初回セットアップ

GitHubからソースを取得したPCで、PowerShellを開いて実行します。

```powershell
git clone https://github.com/matsuokakoki/hanahuda.git
cd hanahuda
npm ci
firebase login
firebase projects:list
```

`firebase projects:list` に `hanahuda-adf91` が表示されることを確認します。

## 公開前の確認

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Firebase Consoleで次が済んでいることを確認します。

- 匿名Authenticationが有効
- Firestore Databaseが本番モード、`asia-northeast1`（東京）
- Cloud Functionsを使うためのBlazeプランへの変更を、所有者が明示的に了承済み

## 本番公開

次のコマンドは実際にHosting、Functions、Firestore Rulesへ変更を送信します。

```powershell
firebase deploy --project hanahuda-adf91 --only functions,firestore,hosting
```

完了後に表示される `https://hanahuda-adf91.web.app` をiPhone、iPad、PCで開きます。

## 更新を公開する

```powershell
cd C:\path\to\hanahuda
git pull
npm ci
npm run typecheck
npm run lint
npm test
npm run build
firebase deploy --project hanahuda-adf91 --only functions,firestore,hosting
```

## 注意

- `node_modules`、`dist`、`.firebase-data`、秘密鍵、サービスアカウントJSONはGitHubへ追加しません。
- Firebase Web設定のAPIキーはブラウザアプリに含まれる公開識別子です。認可は匿名AuthenticationとFirestore Rulesで制御します。
- `firebase deploy` の実行前には、必ず対象プロジェクトが `hanahuda-adf91` であることを確認します。
