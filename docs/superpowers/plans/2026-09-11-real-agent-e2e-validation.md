# Real Agent End-to-End Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate and repair the complete CodeAgent Studio flow from Electron UI through each real Agent CLI, transcript persistence, restart replay, and native Pi resume.

**Architecture:** Use the Electron main process as the only process launcher and persistence owner. The renderer communicates through preload IPC, while each Provider normalizes CLI output into the project protocol and SessionService stores app metadata/messages in SQLite.

**Tech Stack:** Electron Forge, React, TypeScript, Vite, Vitest, Playwright, SQLite/better-sqlite3, Monaco Editor, Claude Code, Cursor Agent, Codex CLI, Pi CLI, OpenCode CLI.

---

## Scope and prerequisites

- Real model credentials must already be configured by the user; never commit or print API keys.
- Test project: `D:/DevWork/codeagent-studio` unless the user selects another directory.
- Each real prompt must be minimal: `Reply with exactly CODEAGENT_<PROVIDER>_OK`.
- A provider failure must be recorded with command, exit code, and sanitized stderr; secrets are excluded.

### Task 1: Start Electron and verify project registration

**Files:**
- Modify: `apps/desktop/src/main/main.ts` only if startup or database initialization fails.
- Test: `apps/desktop/src/main/workspace/workspace-service.test.ts` for registration regressions.

- [x] Run `pnpm --filter @codeagent-studio/desktop start`.
- [x] Confirm the Electron main process and Forge Vite renderer launch without path errors.
- [ ] Choose/register a real project directory and confirm the project root is persisted in SQLite.
- [ ] Stop the app and record any startup failure without changing user files.

### Task 2: Execute real prompts provider by provider

**Files:**
- Modify: `apps/desktop/src/main/providers/cli-providers.ts` and `apps/desktop/src/main/providers/pi-cli-transport.ts` only for observed command/argument failures.
- Test: `apps/desktop/src/main/providers/agent-chat.integration.test.ts` for normalized event behavior.

- [x] Send the minimal prompt to Claude and capture a real response.
- [x] Send the same prompt to Cursor with workspace trust enabled when required.
- [x] Send the same prompt to Codex through the Windows shim-safe launcher.
- [x] Send the same prompt to Pi with `sensenova-6.8-flash-lite` configuration.
- [x] Send the same prompt to OpenCode with model ID `sensenova/sensenova-6.8-flash-lite`.
- [ ] Confirm the ChatPanel renders incremental output and unlocks input after terminal event.

### Task 3: Verify SQLite persistence

**Files:**
- Inspect/modify: `apps/desktop/src/main/storage/session-repository.ts`, `apps/desktop/src/main/storage/schema.ts`, `apps/desktop/src/main/sessions/session-service.ts`.
- Test: `apps/desktop/src/main/storage/database.test.ts` and `apps/desktop/src/main/sessions/session-service.test.ts`.

- [ ] Confirm one session row exists per app session with provider, scope, project, status, and native mapping fields.
- [ ] Confirm user and agent messages are stored in `messages` and ordered by sequence/time.
- [ ] Confirm no API key or authorization header appears in database rows or logs.
- [ ] Run `pnpm test`; native SQLite tests may only be skipped when the binding is unavailable.

### Task 4: Restart and replay transcripts

**Files:**
- Modify: `apps/desktop/src/renderer/workbench/Workbench.tsx` or `apps/desktop/src/renderer/chat/ChatPanel.tsx` only for observed hydration errors.
- Test: `apps/desktop/src/renderer/chat/ChatPanel.test.tsx` and `apps/desktop/src/renderer/workbench/Workbench.test.tsx`.

- [ ] Close Electron after at least one completed session per available provider.
- [ ] Start Electron again and open the Sessions sidebar.
- [ ] Open each historical session and verify transcript replay without starting a Provider.
- [ ] Verify the selected Provider label is preserved in each chat tab.

### Task 5: Resume Pi and degrade unsupported providers

**Files:**
- Modify: `apps/desktop/src/main/providers/agent-ipc.ts`, `apps/desktop/src/main/providers/pi-provider.ts`, `apps/desktop/src/main/storage/session-repository.ts`.
- Test: `apps/desktop/src/main/providers/pi-provider.test.ts` and a restart fixture.

- [ ] Send a second prompt to a persisted Pi session and verify the same native session file is used.
- [ ] Verify Pi app session ID, native ID, and native session file remain mapped after restart.
- [ ] Attempt resume for a CLI provider without native resume support and verify replay-only/new-run behavior is explicit.
- [ ] Never delete or overwrite a provider transcript during fallback.

### Task 6: Repair and record validation results

**Files:**
- Create: `docs/real-agent-validation.md`.
- Modify: the smallest provider/test file needed for each observed failure.

- [ ] Record date, OS, CLI versions, command form, model, result, and sanitized failure.
- [ ] Run `pnpm verify` after repairs.
- [ ] Run `pnpm --filter @codeagent-studio/desktop package` on Windows and record the ZIP artifact.
- [ ] Commit each repair separately with a focused message.

## Deferred follow-up plan

- Session title, rename, and archive.
- Automatic discovery of native provider transcripts.
- System keychain credential storage.
- File save conflict detection.
- macOS/Linux physical packaging validation.
- Playwright automated acceptance suite.
