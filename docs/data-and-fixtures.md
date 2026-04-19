# Data And Fixtures

## Data Versioning

ゲームデータには `dataVersion` を付ける。セーブデータ、replay、golden result はこの version を記録する。

```json
{
  "dataVersion": "0.1.0",
  "ships": [],
  "weapons": [],
  "missions": []
}
```

## Master Data

初期データ種別:

- hulls
- engines
- armors
- weapons
- aircraft
- shipTemplates
- enemyTemplates
- bosses
- missions
- rewards
- researchNodes

## ID 規約

ID は安定させる。表示名変更で ID を変えない。

例:

```text
hull.destroyer.basic
weapon.gun.127mm.single
weapon.torpedo.533mm.basic
mission.mvp.harbor_assault
boss.prototype.fortress_ship
```

## Schema Validation

data harness で検証する項目:

- required field
- unknown field
- numeric range
- enum value
- reference integrity
- circular dependency
- duplicate ID
- unavailable reward
- impossible mission objective

## Fixtures

fixture は小さく、目的が明確なものにする。

```json
{
  "id": "mvp-gunnery-basic",
  "seed": "gunnery-basic-001",
  "missionId": "mission.test.open_water",
  "playerFleet": "fleet.fixture.single_destroyer",
  "inputLog": "inputs/gunnery-basic.json",
  "expect": {
    "result": "completed",
    "maxDurationTicks": 1800,
    "minHitRatePrimary": 0.25
  }
}
```

## Fixture Categories

- `smoke`: 起動と基本戦闘
- `weapon`: 兵装単体
- `movement`: 移動、旋回、衝突
- `ai`: 敵行動、僚艦行動
- `mission`: 目標と分岐
- `boss`: フェーズ制御
- `save`: セーブ互換
- `regression`: 修正済みバグ

## Golden 管理

golden は過剰に固定しない。演出イベントや描画順ではなく、 gameplay に影響する event と metrics を比較する。

比較対象:

- final state digest
- important event digest
- metrics range

比較しない対象:

- particle count
- audio timing
- camera shake
- purely visual animation frame

## Data Review Checklist

データ PR では以下を確認する。

- ID は既存規約に合うか
- 数値の単位が明記されているか
- 参照先が存在するか
- MVP fixture に影響が出ていないか
- balance report の差分が説明できるか
- セーブ互換性に影響がないか

