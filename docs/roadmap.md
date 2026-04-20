# Roadmap

## Phase 0: Project Skeleton

目的:

- Web アプリの基本構成を作る
- テスト、lint、typecheck、E2E の入口を作る
- docs と実装の置き場所を決める

完了条件:

- ローカルで dev server が起動する
- CI 相当のコマンドが存在する
- Playwright smoke が 1 本通る
- data validation の空実装が通る

## Phase 1: Deterministic Combat Core

目的:

- UI なしで戦闘を進められる simulation core を作る

実装:

- fixed tick runner
- seedable random
- entity state
- movement
- basic weapon
- damage
- event log
- metrics

完了条件:

- 同じ seed と input log で同じ digest が出る
- unit tests が主要計算を覆う
- simulation fixture が 3 本通る

## Phase 2: Browser Playable Slice

目的:

- 最小戦闘をブラウザで遊べるようにする

実装:

- canvas rendering
- input adapter
- HUD
- mission start / result flow
- simple enemy AI

完了条件:

- プレイヤー艦が移動、射撃できる
- 敵を撃破して結果画面へ進む
- Playwright で出撃から勝利まで通る
- screenshot と event log が artifact 化できる

## Phase 3: Ship Design MVP

目的:

- 艦船設計を gameplay に接続する

実装:

- hull
- weapon slot
- engine
- armor
- derived stats
- design validation

完了条件:

- 設計データから combat entity を生成できる
- 不正設計が schema と domain validation で弾かれる
- 設計差分が simulation metrics に反映される

## Phase 4: Mission And Campaign

目的:

- 複数ミッションと分岐を扱う

実装:

- mission schema
- objective system
- reward
- route choice
- campaign state

完了条件:

- 3 ミッション以上を選択できる
- 分岐結果がセーブされる
- mission fixture と save migration test が通る

## Phase 5: Fleet, Aircraft, Boss

目的:

- 参照元の魅力である艦隊・航空・巨大兵器戦を独自実装として広げる

実装:

- allied fleet AI
- support fleet command
- aircraft squadron
- boss phases
- repair dock
- secondary damage

完了条件:

- 支援艦隊または航空隊を指令できる
- boss fixture が golden replay で安定する
- balance report で主要ミッションを比較できる

## Release Gate

リリース前に必ず確認する。

- full test suite
- full golden replay
- browser matrix
- save migration matrix
- accessibility smoke
- performance smoke
- manual QA notes

## Continuous Refactoring Gate

機能追加と同じ扱いで、SOLID 原則に基づく構造改善を継続する。

確認項目:

- 新しい機能が既存の巨大 class へ直接追加されていない
- 変更理由ごとに module が分かれている
- rendering、audio、input が simulation に逆依存していない
- strategy table または小さな interface で拡張できる
- `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e` が通る

優先候補:

1. 水柱と陸上砂煙を `effects-renderer` へ移す
2. 船体描画を `ship-renderer` へ移す
3. `RenderContext` を定義して renderer module の引数を整理する
4. event type と effect renderer の対応を registry 化する
