# Test Strategy

## テスト階層

### Unit

対象:

- damage calculation
- armor penetration
- weapon cooldown
- movement integration
- AI decision
- mission objective evaluation
- data schema parser

期待:

- 高速
- seed 固定
- DOM なし
- 失敗時に入力と期待値が明確

### Integration

対象:

- ship design から combat entity 生成まで
- mission data から spawn まで
- weapon fire から projectile hit まで
- repair dock の entering、stopping、complete まで
- save load と migration

### Simulation Golden Replay

代表 fixture を固定し、event log digest を golden と比較する。

例:

- `mvp-gunnery-basic`
- `mvp-torpedo-approach`
- `mvp-aa-defense`
- `boss-phase-01`
- `repair-dock-basic`

golden 差分が出たら、意図した gameplay change か regression かをレビューする。

### Browser E2E

Playwright で検証する。

- app が起動する
- 設計画面で部品を配置できる
- 出撃できる
- 戦闘画面で移動、照準、射撃できる
- 結果画面へ遷移する
- screenshot に canvas が描画されている
- desktop と mobile で主要 UI が重ならない

### Visual Smoke

最初は pixel-perfect snapshot ではなく、重要領域の非空白検証から始める。

- canvas の有効ピクセル率
- HUD 領域の存在
- modal の表示・非表示
- 主要ボタンの hit target

## CI ゲート

Pull request では以下を必須にする。

1. format
2. lint
3. typecheck
4. unit tests
5. integration tests
6. data validation
7. selected golden replay
8. Playwright smoke

main branch では追加で以下を実行する。

- full golden replay
- balance smoke
- save migration matrix
- browser matrix

## 失敗時の成果物

テスト失敗時は以下を artifact として残す。

- seed
- fixture ID
- input log
- event log
- metrics JSON
- final state summary
- screenshot
- Playwright trace
- browser console log

## バランス変更のレビュー

兵装や敵 AI の値を変更した場合、テストが通るだけでは不十分。balance report で以下を見る。

- 代表ミッションの平均クリア時間
- プレイヤー被ダメージ
- 弾薬消費
- 武器別ダメージ比率
- ボスフェーズ滞在時間
- AI 艦の生存時間

## 手動 QA の扱い

手動 QA は「楽しいか」「読めるか」「違和感がないか」を見るために使う。再現性が必要なバグは、最終的に fixture、seed、input log、または E2E に落とす。

