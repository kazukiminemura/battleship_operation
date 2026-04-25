$ErrorActionPreference = 'Stop'

$BaseUrl = $env:AIVIS_ENGINE_URL
if (-not $BaseUrl) {
  $BaseUrl = 'http://127.0.0.1:10101'
}

$OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'src\assets\audio\aivis-navigator'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Lines = @(
  @{ id='combat-start';      text='出撃。戦闘を開始します。';       speaker=1310138981; speed=1.04; pitch=-0.02; intonation=1.12; volume=1.0  },
  @{ id='enemy-sunk';        text='敵艦撃沈。';                   speaker=1310138976; speed=1.03; pitch=-0.02; intonation=1.05; volume=0.95 },
  @{ id='mission-completed'; text='任務完了。見事な戦果です。';   speaker=1310138976; speed=1.02; pitch=-0.02; intonation=1.06; volume=1.0  },
  @{ id='mission-failed';    text='任務失敗。撤退を勧告します。'; speaker=1310138979; speed=1.00; pitch=-0.04; intonation=1.04; volume=1.0  },
  @{ id='hp-danger';         text='危険。船体が限界です。';       speaker=1310138981; speed=1.05; pitch=-0.03; intonation=1.18; volume=1.0  },
  @{ id='hp-heavy';          text='大破。損傷が深刻です。';       speaker=1310138979; speed=1.02; pitch=-0.04; intonation=1.08; volume=1.0  },
  @{ id='hp-medium';         text='中破。損傷を確認してください。'; speaker=1310138976; speed=1.02; pitch=-0.02; intonation=1.05; volume=0.95 },
  @{ id='boss-alert';        text='ボス艦隊発見。最大警戒態勢。'; speaker=1310138981; speed=1.06; pitch=-0.03; intonation=1.20; volume=1.0  },
  @{ id='enemy-close';       text='敵艦接近。';                   speaker=1310138981; speed=1.06; pitch=-0.02; intonation=1.14; volume=1.0  },
  @{ id='ammo-empty';        text='弾薬切れです。';               speaker=1310138976; speed=1.03; pitch=-0.02; intonation=1.04; volume=0.92 }
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
    -TimeoutSec 60 | Out-Null

  Write-Output "generated $OutFile"
}
