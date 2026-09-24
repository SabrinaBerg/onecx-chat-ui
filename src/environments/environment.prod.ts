export const environment = {
  production: true,
  apiPrefix: 'bff',
  chatMessageProcessingMode: 'async',
  DEFAULT_LOGO_PATH: '/assets/images/logo.png',
  // Voice mode ships with a mocked backend (#789). Kept enabled so the voice
  // UI is demonstrable; a real voice backend must be wired up before voice
  voiceAiEnabled: true
}
