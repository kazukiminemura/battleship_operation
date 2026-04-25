$ErrorActionPreference = 'Stop'

$BaseUrl = $env:AIVIS_ENGINE_URL
if (-not $BaseUrl) {
  $BaseUrl = 'http://127.0.0.1:10101'
}

$OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'src\assets\audio\aivis-briefing'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Lines = @(
  @{ id='stage-01'; text='ステージ1、アウターパトロール。敵哨戒部隊と沿岸施設を確認。遮蔽物は少ない。初動で主導権を取ってください。'; speaker=1310138976; speed=1.02; pitch=-0.03; intonation=1.06; volume=1.0 },
  @{ id='stage-02'; text='ステージ2、スクリーニングライン。敵駆逐艦五隻、陸上施設一。西側の礁を利用し、敵を分断してください。'; speaker=1310138976; speed=1.02; pitch=-0.03; intonation=1.06; volume=1.0 },
  @{ id='stage-03'; text='ステージ3、レイダーパック。巡洋艦を含む襲撃隊を捕捉。火力の高い艦から優先して無力化してください。'; speaker=1310138976; speed=1.02; pitch=-0.03; intonation=1.07; volume=1.0 },
  @{ id='stage-04'; text='ステージ4、アイランドガンズ。敵艦隊と陸上砲台が連携しています。島影で射線を切り替え、各個撃破してください。'; speaker=1310138977; speed=1.00; pitch=-0.04; intonation=1.05; volume=1.0 },
  @{ id='stage-05'; text='ステージ5、クルーザートラップ。巡洋艦戦力が増加。二つの島で進路が絞られます。接近戦を避けてください。'; speaker=1310138977; speed=1.00; pitch=-0.04; intonation=1.05; volume=1.0 },
  @{ id='stage-06'; text='ステージ6、ブロークンストレイト。海峡状の地形です。敵を片側へ誘導し、包囲される前に突破口を開いてください。'; speaker=1310138977; speed=1.00; pitch=-0.04; intonation=1.06; volume=1.0 },
  @{ id='stage-07'; text='ステージ7、フリートヴァンガード。敵前衛艦隊は密度が高い。索敵範囲を保ち、孤立した敵から沈めてください。'; speaker=1310138979; speed=1.01; pitch=-0.05; intonation=1.07; volume=1.0 },
  @{ id='stage-08'; text='ステージ8、ヘヴィスクリーン。巡洋艦四隻を含む重警戒線です。長い浅瀬を盾にして、正面火力を避けてください。'; speaker=1310138979; speed=1.01; pitch=-0.05; intonation=1.08; volume=1.0 },
  @{ id='stage-09'; text='ステージ9、ファイナルアプローチ。敵防衛線は最終段階です。島影からの奇襲に注意し、補給施設を速やかに制圧してください。'; speaker=1310138979; speed=1.01; pitch=-0.05; intonation=1.08; volume=1.0 },
  @{ id='stage-10'; text='ステージ10、ドレッドノートコア。敵中枢に大型艦を確認。護衛を掃討し、ドレッドノートを撃沈してください。最大警戒態勢。'; speaker=1310138981; speed=1.04; pitch=-0.05; intonation=1.18; volume=1.0 }
)

foreach ($Line in $Lines) {
  $QueryUri = "$BaseUrl/audio_query?text=$([uri]::EscapeDataString($Line.text))&speaker=$($Line.speaker)"
  $Query = Invoke-RestMethod -Method Post -Uri $QueryUri -TimeoutSec 30
  $Query.speedScale = $Line.speed
  $Query.pitchScale = $Line.pitch
  $Query.intonationScale = $Line.intonation
  $Query.volumeScale = $Line.volume

  $Json = $Query | ConvertTo-Json -Depth 100
  $OutFile = Join-Path $OutDir "$($Line.id).wav"
  Invoke-WebRequest `
    -Method Post `
    -Uri "$BaseUrl/synthesis?speaker=$($Line.speaker)" `
    -ContentType 'application/json' `
    -Body $Json `
    -OutFile $OutFile `
    -TimeoutSec 90 | Out-Null

  Write-Output "generated $OutFile"
}
