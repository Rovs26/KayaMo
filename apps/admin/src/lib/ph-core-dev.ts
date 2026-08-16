export function isPhCoreEditorEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function assertPhCoreEditor(): void {
  if (!isPhCoreEditorEnabled()) {
    throw new Error('PH core editor is disabled in production.');
  }
}
