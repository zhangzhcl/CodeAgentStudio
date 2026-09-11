import { copyFile, mkdir, realpath, rm, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.xml', '.yaml', '.yml', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp)$/i;

/** 会话 id 会参与目录拼接，只允许无路径语义的字符，防止穿越到项目外。 */
export const SESSION_DIRECTORY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type AttachmentInput = { sourcePath: string; name?: string; mimeType?: string };
export type StagedAttachment = { name: string; relativePath: string; mimeType: string; size: number };

/** mimeType 优先，缺失时按扩展名判断是否图片附件。 */
export function isImageAttachment(attachment: { sourcePath: string; mimeType?: string }): boolean {
  if (attachment.mimeType) return attachment.mimeType.toLowerCase().startsWith('image/');
  return IMAGE_EXTENSIONS.test(attachment.sourcePath);
}

export async function stageAttachments(projectRoot: string, sessionId: string, inputs: AttachmentInput[]): Promise<StagedAttachment[]> {
  if (!SESSION_DIRECTORY_PATTERN.test(sessionId)) throw new Error(`非法的会话标识: ${sessionId}`);
  const root = await realpath(projectRoot);
  const targetDir = resolve(root, '.codeagent', 'attachments', sessionId);
  await mkdir(targetDir, { recursive: true });
  const staged: StagedAttachment[] = [];
  const written: string[] = [];
  try {
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
      written.push(destination);
      const relativePath = relative(root, destination).split(sep).join('/');
      staged.push({ name: safeName, relativePath, mimeType: input.mimeType || 'application/octet-stream', size: info.size });
    }
  } catch (error) {
    // 多附件部分失败时回收本次已复制的文件，不在项目里留下孤儿附件
    await Promise.all(written.map((file) => rm(file, { force: true }).catch(() => undefined)));
    throw error;
  }
  return staged;
}
