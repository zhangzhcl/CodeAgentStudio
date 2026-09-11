import { copyFile, mkdir, realpath, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.xml', '.yaml', '.yml', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']);

export type AttachmentInput = { sourcePath: string; name?: string; mimeType?: string };
export type StagedAttachment = { name: string; relativePath: string; mimeType: string; size: number };

export async function stageAttachments(projectRoot: string, sessionId: string, inputs: AttachmentInput[]): Promise<StagedAttachment[]> {
  const root = await realpath(projectRoot);
  const targetDir = resolve(root, '.codeagent', 'attachments', sessionId);
  await mkdir(targetDir, { recursive: true });
  const staged: StagedAttachment[] = [];
  for (const input of inputs) {
    const source = await realpath(input.sourcePath);
    const info = await stat(source);
    if (!info.isFile()) throw new Error(`附件不是文件：${input.sourcePath}`);
    if (info.size > MAX_ATTACHMENT_BYTES) throw new Error(`附件超过 20 MB：${input.sourcePath}`);
    const extension = extname(source).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error(`不支持的附件类型：${extension || 'unknown'}`);
    const safeName = basename(input.name || source).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_') || 'attachment';
    const destination = join(targetDir, `${randomUUID()}-${safeName}`);
    await copyFile(source, destination);
    const relativePath = relative(root, destination).split(sep).join('/');
    staged.push({ name: safeName, relativePath, mimeType: input.mimeType || 'application/octet-stream', size: info.size });
  }
  return staged;
}
