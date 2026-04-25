# AivisSpeech Navigator Voice

These WAV files are generated with AivisSpeech Engine for the in-game navigator.

- Voice model: 阿井田 茂
- Styles: ノーマル, Heavy, Shout
- Engine endpoint used during generation: `http://127.0.0.1:10101`
- Regeneration script: `scripts/generate_aivis_navigator.ps1`

Run from the repository root while AivisSpeech Engine is running:

```powershell
.\scripts\generate_aivis_navigator.ps1
```

Set `AIVIS_ENGINE_URL` to use a non-default engine URL.
