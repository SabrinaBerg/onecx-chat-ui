export const environment = {
  production: true,
  apiPrefix: 'bff',
  chatMessageProcessingMode: 'async',
  DEFAULT_LOGO_PATH: '/assets/images/logo.png',
  // TODO(#789): voice backend is still mocked — keep true for local-env UI work,
  // flip to false before merging to production.
  voiceAiEnabled: true
}
