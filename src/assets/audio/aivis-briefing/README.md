# AivisSpeech Stage Briefings

These WAV files are generated with AivisSpeech Engine for the operation briefing screen.

- Voice model: 阿井田 茂
- Styles: ノーマル, Calm, Heavy, Shout
- Engine endpoint used during generation: `http://127.0.0.1:10101`
- Regeneration script: `scripts/generate_aivis_briefings.ps1`

Run from the repository root while AivisSpeech Engine is running:

```powershell
.\scripts\generate_aivis_briefings.ps1
```

Set `AIVIS_ENGINE_URL` to use a non-default engine URL.
