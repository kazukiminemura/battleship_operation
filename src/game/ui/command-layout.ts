export const COMMAND_BUTTONS = [
  ['speed.up', '増速 W'], ['speed.down', '減速 S'],
  ['turn.left', '左旋回 ←'], ['turn.right', '右旋回 →'],
  ['weapon.next', '兵装切替'], ['pause', '一時停止'],
  ['sim', '演習 D'], ['return', '帰還 R'],
] as const

export function commandLayout(width: number) {
  const columns = Math.max(1, Math.min(8, Math.floor(width / 90)))
  const height = Math.ceil(COMMAND_BUTTONS.length / columns) * 36 + (width >= 1000 ? 44 : 22)
  const cellWidth = width / columns
  return {
    height,
    buttons: COMMAND_BUTTONS.map(([id, label], index) => ({
      id: `command:${id}`, label,
      x: (index % columns) * cellWidth + 4,
      y: Math.floor(index / columns) * 36 + 4,
      w: cellWidth - 8, h: 30,
    })),
  }
}
