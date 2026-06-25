export interface GeneratedFile {
  /** Path relative to the export root, e.g. "sst.config.ts". */
  path: string;
  content: string;
  language: 'ts' | 'tsx' | 'json' | 'md' | 'env' | 'text';
}

export interface GenerateResult {
  files: GeneratedFile[];
}
