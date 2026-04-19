# Harness Engineering

## ハーネスエンジニアリングの目的

このプロジェクトでは、ハーネスを「ゲームを自動操作・観測・再現・比較するための仕組み」と定義する。Web ゲームは描画、入力、物理、AI、乱数、非同期ロードが絡むため、ハーネスを後付けにするとバグの再現が難しくなる。

最初から以下をプロダクト要件として扱う。

- 同じ seed と同じ入力なら同じ戦闘結果になる
- 失敗した E2E を replay と telemetry から再現できる
- ゲームバランス変更の影響を数値で比較できる
- ブラウザ、解像度、FPS の違いでロジック結果が変わらない
- ミッション、艦船、兵装のデータ変更を自動検証できる

## ハーネスの対象

### Simulation Harness

ゲームロジックを UI なしで実行する。CI で高速に回す中心になる。

責務:

- fixed tick で戦闘を進める
- seed 付き乱数を注入する
- 入力イベント列を再生する
- combat event log を出力する
- 勝敗、被ダメージ、命中率、DPS、経過時間を集計する

### Browser Harness

実ブラウザ上で描画、入力、音なし挙動、ロード、レイアウトを検証する。

責務:

- Playwright でタイトル、設計、出撃、戦闘、結果画面を操作する
- canvas が空白でないことを検証する
- 主要 HUD が重ならないことを検証する
- mobile と desktop viewport を比較する
- WebGL fallback または 2D fallback を確認する

### Data Harness

JSON や YAML などのマスターデータを検証する。

責務:

- schema validation
- ID 重複検知
- 参照切れ検知
- 兵装や船体の数値レンジ検証
- mission の spawn table と reward table の整合性検証

### Balance Harness

自動戦闘や scripted input によってバランス変化を比較する。

責務:

- 同一 fixture での勝率、平均クリア時間、被ダメージ比較
- weapon tuning の before / after diff
- boss phase の到達率
- AI 艦隊同士の smoke simulation

### Save Harness

セーブデータの互換性を守る。

責務:

- versioned save schema
- migration test
- corrupted save の復旧テスト
- localStorage / IndexedDB の容量テスト

## 推奨ディレクトリ

```text
src/
  game/
    simulation/
    data/
    rendering/
    ui/
    input/
  harness/
    simulation/
    browser/
    balance/
    fixtures/
tests/
  unit/
  integration/
  e2e/
docs/
```

## 実装上の境界

### Pure Core

戦闘計算、移動、命中判定、AI decision は可能な限り pure function に寄せる。

入力:

- current state
- command
- deterministic random source
- static data

出力:

- next state
- events
- metrics

### Impure Shell

ブラウザ API、描画、音、ネットワーク、ストレージ、時刻は shell 側に閉じ込める。テストでは fake adapter に差し替える。

### Event Log First

ゲーム内で重要な出来事は event log として出す。

例:

```json
{
  "tick": 180,
  "type": "weapon.hit",
  "sourceId": "ship.player",
  "targetId": "ship.enemy.destroyer.01",
  "weaponId": "gun.127mm.single",
  "damage": 42,
  "position": { "x": 1200, "y": -340 }
}
```

UI は event log を見て演出できるが、勝敗判定は simulation state から行う。

## 成功条件

- ローカルで `npm test` 相当の単一コマンドが通る
- 失敗した戦闘テストは seed、fixture、入力列で再現できる
- 主要データ変更時に balance report が生成される
- E2E 失敗時に screenshot、trace、event log が残る
- リリース候補は golden replay の差分レビューを通る

