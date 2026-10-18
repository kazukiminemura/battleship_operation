# SOLID Refactoring Guide

## 目的

この文書は、Battleship Operation を機能追加しながら安全に分割していくための設計ルールを定義する。目標は「大きいファイルを小さくすること」ではなく、変更理由ごとに責務を分け、テストしやすく、差し替えやすく、壊れにくい構造へ寄せること。

特に `src/game/rendering/` は演出が増えるほど肥大化しやすいため、SOLID 原則を使って段階的に分離する。

## 現在の基本方針

- `CanvasRenderer` は描画順序と画面全体の orchestration を担当する。
- 弾、航跡、爆発、HUD、入力、音、simulation はそれぞれ別の変更理由を持つため、同じクラスへ戻さない。
- simulation state は gameplay の事実を表し、rendering module はそれを見た目へ変換する。
- ブラウザ API に依存する処理は rendering/audio/input の shell 側に閉じ込める。
- 新しい演出を追加するときは、まず既存 renderer へ委譲できるか、独立 renderer にすべきかを判断する。

## 艦船描画の責務分担

- `combat-ship-config.ts`: 戦闘中の艦船データを、設計画面と共通の船体生成設定へ変換する。
- `combat-ship-visual.ts`: 共通モデル、影、砲塔参照を生成する。船首はモデルのローカル +X とする。
- `ship-projection.ts`: 艦の位置と角度を、注入された `w2s` に従って画面へ投影する。Canvas の下向き Y と Three.js の上向き Y の変換をここに集約する。
- `ship-turret-traverse.ts`: 目標選択と砲塔の旋回表示を担当する。
- `ThreeBattlefieldRenderer`: シーンと描画ライフサイクルを管理し、上記の関数へ委譲する。

投影は位置・角度と投影関数だけに依存し、simulation state を変更しない。航跡・煙は実際のモデル行列から取得した取付点を利用する。航跡描画は `ShipWakeRenderer` が担当し、船首の水しぶきは描画しない。継承階層や未使用の汎用 registry は追加しない。

`ship-heading-projection.test.ts` は船首から船尾への軸と前進の投影を16方向で比較する。実際の駆逐艦・巡洋艦・戦艦モデルについても、複数のズームと傾斜で衝突判定の船体寸法との一致を検証する。修正前の上下反転は16方向中14方向で再現し、回帰テストが検出する。

## SOLID の適用ルール

### S: Single Responsibility

1 ファイルまたは 1 クラスが持ってよい変更理由は 1 つにする。

良い例:

- `projectile-renderer.ts`: projectile の軌道と弾種別の描画
- `wake-renderer.ts`: 艦の航跡履歴と航跡描画
- `effects-renderer.ts`: 爆発、着弾、水柱、砂煙などの演出描画
- `ship-rendering-data.ts`: 艦の描画寸法と形状分類

避ける例:

- `CanvasRenderer` に弾、航跡、爆発、水面、HUD、入力補助の詳細をすべて追加する
- simulation module に canvas の色、線幅、スプライト生成を入れる
- UI module に weapon damage や hit 判定を入れる

判断基準:

- 「この変更は gameplay balance か、見た目か、入力か、音か、データ定義か」を言えるか
- 同じファイルを触る理由が 2 種類以上に増えていないか
- その機能だけを単体で読み、テストし、差し替えられるか

### O: Open/Closed

新しい種類を足すとき、既存の大きな関数を編集し続ける構造を避ける。

推奨:

- 弾種別の描画は strategy table に登録する
- weapon behavior は `WeaponStrategy` のような型で揃える
- effect 種別は小さな render function に分け、必要なら registry 化する
- data-driven にできる数値は static data や profile へ寄せる

例:

```ts
const PROJECTILE_RENDERERS: Record<WeaponType, ProjectileRenderStrategy> = {
  gun: renderGun,
  missile: renderMissile,
  torpedo: renderTorpedo,
  secondary: renderSecondary,
  aa: renderAa,
}
```

新しい weapon type を追加する場合は、型、simulation strategy、render strategy、audio strategy を揃える。`CanvasRenderer` の巨大な `switch` を増やす方向には戻さない。

### L: Liskov Substitution

同じ interface や strategy 型を実装するものは、呼び出し側から同じ契約で扱えるようにする。

ルール:

- renderer strategy は描画だけを行い、simulation state を変更しない
- weapon strategy は同じ入力から同じ形の config と判定結果を返す
- adapter を差し替えても replay や unit test の結果が変わらない

悪い兆候:

- `if (rendererName === 'missile')` のような特別扱いが呼び出し側へ漏れる
- 特定 strategy だけ副作用で state を変更する
- 型は同じなのに、未対応値で silent failure する

### I: Interface Segregation

大きすぎる context object を渡さない。必要な能力だけを渡す。

推奨:

- projection が必要な renderer には `w2s` と `scale` だけを渡す
- event renderer には `events`, `tick`, `entities` だけを渡す
- module が `CanvasRenderer` 全体へ依存する形を避ける

避ける例:

```ts
renderEffect(canvasRenderer, state)
```

推奨例:

```ts
renderShipExplosions(ctx, iso, w2s, events, tick, entities)
```

### D: Dependency Inversion

上位の orchestration は具象実装の内部詳細に依存しない。

ルール:

- `CanvasRenderer` は renderer の public method または pure function だけを呼ぶ
- renderer module は `CanvasRenderer` の private field に触らない
- simulation は rendering/audio/input に依存しない
- 乱数や時刻は直接呼ばず、必要なら注入する

## Rendering 分割ガイド

### CanvasRenderer に残すもの

- canvas lifecycle
- camera と projection
- top-level render order
- high-level layer composition
- selected weapon range や aim pointer のような画面全体の補助

### 専用 renderer へ出すもの

- 弾種ごとの見た目や軌道
- 航跡履歴、泡、船首波、船尾洗流
- 爆発、水柱、砂煙、煙、衝撃波
- 艦描画のサブパーツが増えた場合の hull/deck/superstructure renderer
- UI が複雑化した場合の screen / component renderer

### Shared data へ出すもの

- 艦の描画寸法
- shape class
- 色 profile
- effect duration
- weapon visual profile

shared data は gameplay config と混同しない。見た目だけの数値は rendering 側に置く。damage、range、cooldown など gameplay に影響する値は simulation/data 側に置く。

## リファクタリング手順

1. 変更理由を 1 文で書く。
2. 抜き出す境界を決める。
3. public API を小さくする。
4. 既存の呼び出し順を変えずに委譲へ置き換える。
5. 型チェック、unit test、build、E2E smoke を通す。
6. diff を見て、挙動変更と構造変更が混ざっていないか確認する。

推奨コマンド:

```text
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## レビュー checklist

- `CanvasRenderer` に新しい巨大メソッドを追加していない
- rendering module が simulation state を mutate していない
- module 間の依存方向が `simulation -> rendering` になっていない
- strategy table や small function で拡張できる
- shared data は gameplay data と visual data に分かれている
- tests または smoke check で起動確認している
- 既存の replay 契約や event log 契約を壊していない

## 今後の候補

- `water-impact-renderer.ts`: 水柱、波紋、泡散乱
- `land-impact-renderer.ts`: 陸上着弾、砂煙、土煙
- `ship-renderer.ts`: 船体、甲板、艦橋、砲塔
- `render-context.ts`: `ctx`, `iso`, `w2s` の最小 context 化
- `effect-registry.ts`: event type と effect renderer の対応表

