> **履歴資料:** これは初期要件の記録です。現在の実装とは異なる箇所（例: 1戦制と再戦）があるため、現行仕様や作業指示として扱わず、[README](../../README.md) とコードを参照してください。

# 完全新規フォルダ用：友達と遊べるエクストリーム花札 実装指示書

この文書だけを読んで実装すること。過去の会話、別リポジトリ、既存README、添付ファイル、既存コードは存在しない前提で開始する。空のフォルダに新規プロジェクトを作り、完成した制作物はこの作業場所の外部から見えない環境で作る。

## 1. 最終目的

商用サービスではなく、作者と友達が数回遊べる2人対戦Webゲームを完成させる。作者がFirebase HostingのURLを友達へ共有し、2人が各自のスマートフォンまたはPCブラウザで同じ部屋に入り、部屋作成から対局終了まで画面操作だけで遊べる状態にする。

優先順位は次の通り。

1. 2人が接続できること。
2. 部屋作成、部屋ID参加、ready、開始ができること。
3. 手札、場札、同月選択、役、HP、ターンが同期すること。
4. 覚醒、必殺、月別戦術、投了、時間切れ、引き分けを処理できること。
5. 対局終了後に勝者と最終HPを表示すること。
6. Emulatorで再現でき、最小構成をFirebaseへデプロイできること。

## 2. 今回やらないこと

次は実装しない。必要ならREADMEのTODOに一行だけ記録する。

- App Checkの本番強制
- 本格的なレート制限、WAF、Bot対策
- TTLや期限切れ対戦の再帰削除
- 監視、アラート、分析、課金最適化
- ランキング、チャット、フレンド一覧、観戦、マッチング
- 3人以上の対戦、乱戦、複数局
- ネイティブアプリ
- アカウント登録、メールログイン、Googleログイン画面
- オフライン対戦、PWA、プッシュ通知

ログイン画面は作らない。ただしサーバーのCallable認証を満たすため、アプリ起動時にFirebase匿名認証を自動実行してuidを取得する。ユーザーには「ログイン」という操作を見せない。

## 3. 技術構成

- TypeScript、Node.js 22、npm workspaces。
- WebはReact + Vite + Firebase Web SDK。
- バックエンドはFirebase Cloud Functions v2（TypeScript、Node.js 22）。
- データベースはCloud Firestore。
- ローカル開発とテストはDocker Compose内でNode.js、Java 21、Firebase CLI、Emulatorを動かす。ホストOSへこれらをインストールしない。
- ゲームルールは`packages/game-core`というFirebase非依存の純粋TypeScriptReducerに置く。Functionsからだけ呼び出す。
- 本番プレイはDocker不要。Firebase Hosting上の静的Web、デプロイ済みFunctions、Firestoreを使う。

## 4. ゲームの確定ルール

### 4.1 勝利条件と初期状態

- 2人用の1戦制。通常花札の「こいこい／勝負」、複数回戦、7点以上2倍は採用しない。
- 札は12月×4枚、合計48枚。`cardId`は`1-1`〜`12-4`の安定IDとし、名前から判定しない。
- 各プレイヤーの初期HPは300、最大HPも300。
- 初期配札は各プレイヤー8枚、場札8枚、山札24枚。
- 先攻はサーバー乱数で決める。キャラクターも各プレイヤー1〜12月からサーバー乱数で抽選する。同じキャラクターを許可する。
- 初期場札に同月4枚、または手札に同月4枚／同月2枚×4組があれば無料得点防止のため全体を再シャッフルする。最大100回、それでも無理なら安全な開始エラーにする。
- シャッフル、先攻、キャラクター、コイン、ランダムハンデスは暗号学的乱数から作ったseedとcounterを使う決定論的RNGで処理する。seedと山札順はクライアントへ返さない。

### 4.2 カード分類

カード定義には`month`、`category`、`yakuTags`を持たせる。

- 光：1月「松に鶴」、3月「桜に幕」、8月「芒に月」、11月「柳に小野道風」、12月「桐に鳳凰」。
- 種：2月「梅に鶯」、4月「藤に不如帰」、5月「杜若に八橋」、6月「牡丹に蝶」、7月「萩に猪」、8月「芒に雁」、9月「菊に盃」、10月「紅葉に鹿」、11月「柳に燕」。
- 短冊：1・2・3月は文字入り赤短、6・9・10月は青短、4・5・7・11月は通常短冊。
- カス：上記以外。12月はカス3枚。菊に盃は種とカスの両方のタグを持つがカード実体は1枚。
- 各月の4枚に固有の`cardId`を割り当て、同じカードが手札・場・取得札・山札に重複しないことを不変条件にする。

### 4.3 1ターンの処理

1. `PLAY_HAND_CARD`で手札から1枚を選ぶ。
2. 場に同月札が0枚なら出した札を場へ置く。
3. 同月札が1枚なら出した札とその札を取得する。
4. 同月札が2枚なら2枚のどちらを取得するか本人に選ばせ、選択後に出した札と選択札を取得する。
5. 同月札が3枚なら4枚すべて取得する。
6. 取得が発生した月のキャラクター戦術を1回解決する。
7. 山札が残っていれば先頭を1枚めくる。公開された札について同じ0/1/2/3枚処理を行う。2枚なら`CHOOSE_DRAW_MATCH`で本人に選ばせる。
8. そのターンの役点差分を計算し、回復または必殺、覚醒選択、強制覚醒、HP0判定を順に解決する。
9. 終了しなければ相手のターンへ移り、`stateVersion`を1増やす。

手札切りと山札めくりは別イベントで、1ターンに戦術が最大2回発動する。山札0はエラーではなく、ドロー処理を省略する。最後の手札を出した場合も、山札めくり、役、効果、勝敗判定まで行う。

### 4.4 役と得点

取り札の役合計をターン開始時と終了時で比較し、`turnScore = max(0, after - before)`とする。

| 役ID | 条件 | 点 |
|---|---|---:|
| `five_brights` | 光5枚 | 10 |
| `four_brights` | 柳に小野道風を含まない光4枚 | 8 |
| `rainy_four_brights` | 柳に小野道風を含む光4枚 | 7 |
| `three_brights` | 柳に小野道風を含まない光3枚 | 5 |
| `boar_deer_butterflies` | 猪・鹿・蝶 | 5 |
| `poetry_ribbons` | 1・2・3月の赤短 | 5 |
| `blue_ribbons` | 6・9・10月の青短 | 5 |
| `cherry_viewing` | 桜に幕・菊に盃 | 5 |
| `moon_viewing` | 芒に月・菊に盃 | 5 |
| `animals` | 種5枚で1、6枚目以降は1枚ごと+1 | 1+ |
| `ribbons` | 短冊5枚で1、6枚目以降は1枚ごと+1 | 1+ |
| `chaff` | カス10枚で1、11枚目以降は1枚ごと+1 | 1+ |

光役は最も高い1役だけを採用する。他の役は重複可。成立中の役と合計点は公開情報にする。

### 4.5 HP、戦術、覚醒、必殺

- 1〜4点なら自分を`turnScore×10`回復（最大300）。
- 5点以上なら共通回復を行わず、必殺を1回だけ発動する。
- 5点以上かつ未覚醒なら`CHOOSE_AWAKENING`で本人に覚醒する／しないを選ばせる。拒否しても必殺は発動する。後の5点以上ターンで再選択できる。
- HPが1〜100になった効果解決直後は強制覚醒する。HP0では覚醒せず敗北判定へ進む。
- HPは常に0〜300にクランプする。HP0の同時発生は引き分け。
- 月別基本戦術は1月攻撃10、2月攻撃20、3月攻撃30、4月回復20、5月攻撃10、6月攻撃20、7月攻撃30、8月コイン（表攻撃50／裏自傷10）、9月攻撃10、10月攻撃20、11月攻撃30、12月攻撃10＋場札1枚追加。
- キャラクター固有の通常面／覚醒面は次の表で上書きする。技名文字列を解析してはならず、構造化`Effect`で表現する。

## 5. キャラクター仕様

キャラクターは次の12人から抽選する。`normalName`、`awakenedName`、軍、抽選月、通常戦術、覚醒戦術、特殊効果IDを静的データとして持つ。

| ID | 通常→覚醒 | 軍 | 固有戦術（通常／覚醒） | 特殊効果 |
|---|---|---|---|---|
| `date_masamune` | 伊達政宗→独眼竜 | DATE | 通常7月騎兵50・11月射撃50／覚醒5月騎兵20、6月30、7月60、9月射撃20、10月30、11月60 | 必殺50+10、騎兵・射撃+10 |
| `maeda_keiji` | 前田慶次→前田慶次 | UESUGI | 通常8月騎兵コイン100／覚醒1〜7月歩兵・騎兵コイン50、8月100 | 5点以外の奇数点で即死、歩兵・騎兵コイン化 |
| `mori_motonari` | 毛利元就→毛利元就 | MORI | 通常9月射撃50／覚醒9月70、10月40、11月50、12月虚報30＋場札 | 必殺+10、覚醒後虚報で即死、射撃+20 |
| `sanada_yukimura` | 真田幸村→真田幸村 | TAKEDA | 通常2月歩兵50／覚醒1月20、2月30、3月40、5月騎兵30、6月40、7月50 | 必殺+10、徳川攻撃-20、歩兵+10・騎兵+20 |
| `tokugawa_ieyasu` | 徳川家康→徳川家康 | TOKUGAWA | 3月攻撃30＋回復30（通常・覚醒） | 必殺+10、覚醒後の取得ごと自己回復10＋相手攻撃20 |
| `hojo_ujiyasu` | 北条氏康→北条氏康 | HOJO | 4月回復20＋通常攻撃無効1回（通常・覚醒） | 必殺+10、数値攻撃-20 |
| `uesugi_kenshin` | 上杉謙信→越後の龍 | UESUGI | 通常5月騎兵50／覚醒1月歩兵30、2月40、3月50、5月騎兵70、6月40、7月50、9月射撃30、10月40、11月50 | 必殺+20、次の武田攻撃-10、全数値攻撃+20 |
| `saika_magoichi` | 雑賀孫一→雑賀孫一 | HONGANJI | 通常10月射撃コイン100／覚醒9月射撃30、10月コイン120/70、11月50 | 必殺+10、次ターン狙い撃ち即死、織田攻撃-10、射撃+20 |
| `takeda_shingen` | 武田信玄→甲斐の虎 | TAKEDA | 通常6月騎兵50／覚醒5月60、6月100、7月80 | 必殺+20、次の上杉攻撃-10、騎兵+50 |
| `oda_nobunaga` | 織田信長→魔王 | ODA | 通常11月射撃90／覚醒1月歩兵20、2月30、3月40、5月騎兵20、6月30、7月40、9月射撃30、10月40、11月110 | 必殺+20、相手次ターン騎兵通常-10、歩兵・騎兵+10・射撃+20 |
| `toyotomi_hideyoshi` | 豊臣秀吉→太閤 | TOYOTOMI | 通常12月攻撃10＋相手手札1枚を場へ／覚醒4月回復40、12月同技 | 必殺+10＋山札1枚追加、相手取得反応攻撃30、補給回復+40 |
| `shimazu_yoshihiro` | 島津義弘→鬼島津 | SHIMAZU | 通常1月歩兵50／覚醒1月60、2月30、3月40、9月射撃20、10月30、11月40 | 必殺+10、HP0を1回10で耐える、歩兵・射撃+10 |

固有効果の実装上の確定事項：即死は軽減・通常攻撃無効を無視するが島津の生存効果は適用可。北条の無効は月別通常攻撃のみ。攻撃補正は加算後に最小0。豊臣のハンデスと追加ドローは各1試合1回。効果期間は「所有者の次ターン開始直前」または「対象の次ターン終了時」など、Statusの開始・終了ターンを明示して管理する。

## 6. バックエンドとデータモデル

Callable Functionsを次の7つ作る。

- `createMatch`: 2人部屋と招待コードを作る。
- `joinMatch`: コードで2人目として参加する。
- `setReady`: 自分のreadyを変更する。
- `startMatch`: 2人ready後にゲームを初期化する。
- `submitGameCommand`: Reducerへゲームコマンドを渡す中心Function。
- `forfeitMatch`: ACTIVE中の呼び出し本人を敗者にする。
- `claimTimeout`: deadline後に手番プレイヤーを敗者にする。

Firestoreの最低限のパスは次の通り。

```text
matches/{matchId}                         公開状態
matches/{matchId}/private/{uid}           本人の手札・本人用選択肢
matches/{matchId}/events/{eventId}        秘密を含まない公開イベント
matches/{matchId}/server/state            seed・山札・完全状態（server-only）
commandResults/{matchId}_{uid}_{commandId} 冪等結果（server-only）
roomCodes/{normalizedCode}                招待コード索引（server-only）
```

公開状態にseed、山札順、相手手札、未公開pending choice、内部status詳細を含めない。privateにも自分に必要な情報だけを含める。完全状態・公開・両private・event・commandResultは同じFirestore transactionで更新する。

## 7. コマンドと認可

すべての入力はスキーマ検証し、unknown fieldを拒否する。`matchId`、`commandId`、招待コードにはASCII形式と最大長を設け、Unicode正規化・パス注入を許可しない。

`submitGameCommand`の入力は次の形にする。

```ts
{
  matchId: string,
  commandId: string,
  expectedStateVersion: number,
  type: "PLAY_CARD" | "CHOOSE_MATCH" | "CHOOSE_AWAKENING",
  payload: { cardId?: string, matchedCardId?: string, awaken?: boolean }
}
```

処理順序は必ず、Auth確認→入力検証→transaction→既存commandResult確認→完全状態読込→participant/status/activePlayer/phase/version確認→Reducer→不変条件確認→全投影とevent/result書込→commitとする。readをすべてwriteより前に行う。

同じuid・matchId・commandId・同じcanonical payloadは保存済み結果を返す。異なるpayloadなら`already-exists`または`failed-precondition`で拒否する。canonical JSONは再帰的にobject keyをソートし、配列順は保持し、undefinedは拒否または明示的に除外し、Timestampはミリ秒数へ変換する。

## 8. Security Rules

deny by default。未認証、第三者、相手private、server/state、roomCodes、commandResultsは読めない。participantだけがmatchesの公開状態とeventsを読め、自分のprivateだけ読める。クライアントからのmatch関連writeはすべて拒否する。collection groupや未知パスにもallowを作らない。FunctionsのAdmin SDKはRulesを迂回するため、Functions側でも同じparticipant・status・turn・phase検査を実施する。

## 9. Docker Compose

空フォルダに次を作る。

```text
docker-compose.yml
Dockerfile.web
Dockerfile.firebase
package.json
packages/game-core/
functions/
apps/web/
firestore.rules
firebase.json
tests/
```

`firebase`コンテナはJava 21と固定版Firebase CLIを含め、Auth 9099、Firestore 8080、Functions 5001、Hosting 5000を公開する。`web`コンテナはNode 22、Viteを`0.0.0.0`で起動する。Emulatorのproject IDは`demo-extreme-hanafuda`に固定し、本番IDを開発スクリプトへ書かない。同一Wi-Fiの友達は作者PCのLAN IPv4と5173を使う。異なるネットワークではEmulatorを直接公開せず、Hosting URLを使う。

## 10. UI要件

- 初期画面に「部屋を作る」「部屋IDで参加」を表示。
- 作成後は招待コードをコピーできる。
- ロビーに2枠、ready、開始ボタンを表示。
- 対局画面は自分の手札だけ表向き、相手は枚数のみ。
- 場札、取得札、HP、役、得点、キャラクター、覚醒、手番、deadlineを表示。
- 同月2枚の選択、覚醒する／しない選択を画面上のボタンで行う。
- 処理中、再接続、古いversion、期限切れ、エラー、FINISHEDを明示。
- FINISHED後はカード操作を無効化し、winner/reason/最終HPを両クライアントに表示。
- 幅360pxのスマートフォン縦画面で横スクロールしない。

## 11. テストと完了条件

Docker内で次を実行し、失敗・skipを残さない。

```text
npm test
npm run test:unit
npm run test:web
npm run test:rules
npm run test:emulators
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

Emulator統合テストはAuth EmulatorでA/B/Cを匿名作成し、create→join→ready→start→command→FINISHEDをCallable経由で実行する。Cの参加・読取を拒否し、相手privateを拒否する。同一commandId再送、payload違い、同時送信、古いversion、投了、timeout、Reducer失敗の原子性を検証する。Playwrightは2ブラウザを使い、固定sleepではなくrole/testid/stateVersion/FINISHEDを待つ。

## 12. 最小デプロイ

EmulatorとE2Eが全成功した後、ユーザーが指定・確認したFirebaseプロジェクトへHosting、Functions、Firestore Rules/indexesだけをデプロイする。App Check強制、レート制限、TTL、監視はデプロイしない。対象project IDを表示してから実行し、課金プラン変更や認証情報要求が出たら停止して報告する。本番データの削除・移行は絶対にしない。

## 13. 最終報告

実装ファイル、Docker起動方法、ローカルURL、Hosting URL、匿名Authを画面ログインなしで使うこと、Emulator/E2Eのテスト件数、デプロイ対象project ID、未実装項目、実行した全コマンド、commit/push/PRをしていないことを報告する。
