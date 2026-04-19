# Simulation Contracts

## 決定性

戦闘ロジックは deterministic であることを基本契約にする。同じ build、同じ data version、同じ seed、同じ input log なら、同じ result digest を返す。

```text
resultDigest = hash(
  gameVersion,
  dataVersion,
  seed,
  inputLog,
  finalStateSummary,
  importantEventLog
)
```

## Tick

- simulation は fixed tick で進行する
- 初期値は 30 ticks/sec
- rendering は interpolation してよい
- gameplay state は `requestAnimationFrame` の実時間差で直接更新しない
- pause、slow motion、fast forward は tick runner の責務にする

## Random

乱数は global `Math.random()` を使わない。必ず seedable random を dependency injection する。

用途ごとに stream を分ける。

- `combat`: 命中、散布界、クリティカル
- `ai`: AI の選択ゆらぎ
- `loot`: 報酬
- `scenario`: ミッション内イベント

これにより、報酬テーブル変更が戦闘命中結果へ波及する事故を避ける。

## Coordinate

初期実装では水平面を `x, z`、高さを `y` として扱う。2D 俯瞰で実装する場合も、将来 3D 化しやすいよう domain model は 3 軸を持つ。

```ts
type Vec3 = {
  x: number;
  y: number;
  z: number;
};
```

## Entity

主要 entity:

- `ship`
- `submarine`
- `aircraft`
- `projectile`
- `torpedo`
- `missile`
- `mine`
- `dock`
- `objective`
- `boss`

Entity は stable ID を持つ。描画 ID と simulation ID を混同しない。

## Command

プレイヤー入力と AI 指令は command として記録する。

```json
{
  "tick": 120,
  "actorId": "ship.player",
  "type": "fire.primary",
  "target": { "x": 820, "y": 0, "z": -210 }
}
```

command は replay、network、AI test の共通入力になる。

## Event

event は「起きた事実」を表す。command と event を分ける。

例:

- `weapon.fired`
- `weapon.hit`
- `weapon.missed`
- `entity.spawned`
- `entity.destroyed`
- `damage.flooding.started`
- `damage.fire.started`
- `repair.started`
- `repair.completed`
- `objective.completed`
- `mission.completed`
- `mission.failed`

## Metrics

戦闘ごとに最低限以下を集計する。

- result
- durationTicks
- playerDamageTaken
- playerAmmoSpent
- hitRateByWeapon
- damageByWeapon
- enemiesDestroyed
- repairCount
- bossPhaseDurations
- objectiveCompletionTicks

## Invariants

常に守る条件:

- HP は `0 <= hp <= maxHp`
- ammo は負にならない
- fuel は負にならない
- destroyed entity は攻撃しない
- projectile は lifetime 終了後に残らない
- mission result は completed と failed を同時に持たない
- replay 再生中に外部時刻へ依存しない

