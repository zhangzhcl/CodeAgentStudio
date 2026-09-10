export type FileVersion = { mtime: number; size: number; hash: string };

export class EditorDocument {
  private currentContent: string;
  private readonly loadedVersion: FileVersion;
  private readonly originalContent: string;

  constructor(readonly path: string, content: string, version: FileVersion) {
    this.currentContent = content;
    this.loadedVersion = version;
    this.originalContent = content;
  }

  get content() { return this.currentContent; }
  get dirty() { return this.currentContent !== this.initialContent; }
  private get initialContent() { return this.originalContent; }
  update(content: string) { this.currentContent = content; }

  prepareSave(diskVersion: FileVersion): { ok: true; content: string } | { ok: false; reason: 'CONFLICT' } {
    const unchanged = diskVersion.mtime === this.loadedVersion.mtime && diskVersion.size === this.loadedVersion.size && diskVersion.hash === this.loadedVersion.hash;
    return unchanged ? { ok: true, content: this.currentContent } : { ok: false, reason: 'CONFLICT' };
  }
}
