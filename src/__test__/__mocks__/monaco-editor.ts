export const languages = {
  getLanguages: () => [
    { id: 'javascript', extensions: ['.js'] },
    { id: 'typescript', extensions: ['.ts'] }
  ]
}

export const editor = {
  create: () => ({
    dispose: () => { /* no-op */ },
    getModel: () => ({}),
    onDidChangeModelContent: () => ({ dispose: () => { /* no-op */ } })
  })
}
