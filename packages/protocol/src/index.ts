import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;

export const ProviderIdSchema = z.enum(['claude', 'cursor', 'codex', 'pi', 'opencode']);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const SessionScopeSchema = z.enum(['project', 'personal']);
export type SessionScope = z.infer<typeof SessionScopeSchema>;

export const WorkspaceEntrySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  isDirectory: z.boolean(),
  mtime: z.number().finite(),
  size: z.number().int().nonnegative(),
});
export type WorkspaceEntry = z.infer<typeof WorkspaceEntrySchema>;

const BaseEventSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
  provider: ProviderIdSchema,
  sequence: z.number().int().nonnegative(),
  occurredAt: z.string().datetime({ offset: true }),
});

export const AgentEventSchema = z.discriminatedUnion('type', [
  BaseEventSchema.extend({ type: z.literal('text_delta'), payload: z.object({ text: z.string() }) }),
  BaseEventSchema.extend({ type: z.literal('tool.started'), payload: z.object({ toolName: z.string().min(1), input: z.unknown() }) }),
  BaseEventSchema.extend({ type: z.literal('tool.completed'), payload: z.object({ toolName: z.string().min(1), output: z.unknown() }) }),
  BaseEventSchema.extend({ type: z.literal('error'), payload: z.object({ code: z.string().min(1), message: z.string() }) }),
  BaseEventSchema.extend({ type: z.literal('done'), payload: z.object({}) }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const MessageDeltaSchema = BaseEventSchema.pick({ sessionId: true, messageId: true, sequence: true })
  .extend({ text: z.string() });
export type MessageDelta = z.infer<typeof MessageDeltaSchema>;

export const WorkbenchTabSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chat'), sessionId: z.string().min(1), scope: SessionScopeSchema.default('project') }),
  z.object({ kind: z.literal('file'), projectId: z.string().min(1), path: z.string().min(1), dirty: z.boolean() }),
]);
export type WorkbenchTab = z.infer<typeof WorkbenchTabSchema>;

export * from './handshake.js';
export * from './event-sequencer.js';
