# Cloud Shellからの本番公開手順

対象Firebaseプロジェクトは `hanahuda-adf91`、対象GitHubリポジトリは `https://github.com/matsuokakoki/hanahuda.git` です。

この手順はDockerを使いません。Cloud Shell上で依存パッケージを一時的に取得し、Hosting・Functions・Firestore Rulesを公開します。iPhone、iPad、PCは公開後のURLを開くだけです。

## 公開前の確認

- Firebase Consoleで匿名Authenticationを有効にしている。
- Firestore Databaseを本番モード、`asia-northeast1`（東京）で作成している。
- GitHubの `main` ブランチに本番用コードがpushされている。
- Cloud FunctionsのためにBlazeプランを有効にすることを理解し、費用上限を確認済みである。

## Cloud Shellで公開する

1. Firebase Console右上のCloud Shellボタンを開く。
2. 初回だけ、Cloud ShellのSSH公開鍵をGitHubリポジトリの読み取り専用Deploy keyとして登録する。個人アクセストークンをコマンドに貼り付けない。

```bash
ssh-keygen -t ed25519 -f ~/.ssh/hanahuda_deploy -N '' -C 'hanahuda-cloud-shell'
cat ~/.ssh/hanahuda_deploy.pub
```

表示された1行をコピーし、GitHubの `matsuokakoki/hanahuda` で「Settings」→「Deploy keys」→「Add deploy key」を開く。名前は `Cloud Shell`、書き込み権限は与えずに保存する。

3. Cloud Shellへ戻り、次を順番に実行する。

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/hanahuda_deploy
git clone git@github.com:matsuokakoki/hanahuda.git
cd hanahuda
npm ci
npm run test
npm run deploy:production
```

4. 完了時に表示される `https://hanahuda-adf91.web.app` をiPhone、iPad、PCで開く。

初回に認証確認が出る場合は、Cloud Shellを開いたGoogleアカウントでFirebaseプロジェクトへのアクセスを許可します。

## 更新を公開する

GitHubへ更新をpushした後、Cloud Shellで次を実行します。

```bash
cd ~/hanahuda
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/hanahuda_deploy
git pull
npm ci
npm run test
npm run deploy:production
```

## 注意

- `npm run deploy:production` は実際に本番へ公開するコマンドです。内容を確認したうえで、所有者が実行します。
- サービスアカウントJSON、秘密鍵、`.env` ファイルはGitHubへ追加しません。
- Firebase Web設定のAPIキーはブラウザアプリに含まれる公開識別子です。認可は匿名AuthenticationとFirestore Rulesで制御します。
