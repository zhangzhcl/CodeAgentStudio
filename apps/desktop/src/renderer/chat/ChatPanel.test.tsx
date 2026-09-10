import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel } from './ChatPanel.js';
describe('ChatPanel', () => { it('sends a prompt and renders it optimistically', async () => { const onPrompt = vi.fn(); render(<ChatPanel sessionId="s" onPrompt={onPrompt} />); fireEvent.change(screen.getByLabelText('消息'), { target: { value: '你好' } }); fireEvent.click(screen.getByRole('button', { name: '发送' })); await waitFor(() => expect(onPrompt).toHaveBeenCalledWith('你好', 'Claude')); expect(screen.getByText('你好')).toBeInTheDocument(); }); it('shows provider errors without losing the user message', async () => { const onPrompt = vi.fn().mockRejectedValue(new Error('未安装')); render(<ChatPanel sessionId="s" onPrompt={onPrompt} />); fireEvent.change(screen.getByLabelText('消息'), { target: { value: '测试' } }); fireEvent.click(screen.getByRole('button', { name: '发送' })); expect(await screen.findByRole('alert')).toHaveTextContent('未安装'); expect(screen.getByText('测试')).toBeInTheDocument(); }); it('aborts the active session and unlocks input', async () => { let resolvePrompt!: () => void; const onPrompt = vi.fn(() => new Promise<void>((resolve) => { resolvePrompt = resolve; })); const onAbort = vi.fn(); render(<ChatPanel sessionId="s" onPrompt={onPrompt} onAbort={onAbort} />); fireEvent.change(screen.getByLabelText('消息'), { target: { value: '运行' } }); fireEvent.click(screen.getByRole('button', { name: '发送' })); await waitFor(() => expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument()); fireEvent.click(screen.getByRole('button', { name: '停止' })); expect(onAbort).toHaveBeenCalledWith('s'); expect(screen.getByLabelText('消息')).not.toBeDisabled(); await act(async () => { resolvePrompt(); }); }); });
describe('ChatPanel composer keyboard behavior', () => {
  it('sends with Enter and preserves newlines with Shift+Enter', async () => {
    const onPrompt = vi.fn();
    render(<ChatPanel sessionId="keyboard" onPrompt={onPrompt} />);
    const input = screen.getByLabelText('消息');
    fireEvent.change(input, { target: { value: '第一行' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onPrompt).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '第一行\n第二行' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onPrompt).toHaveBeenCalledWith('第一行\n第二行', 'Claude'));
  });

  it('keeps send disabled while the draft is empty', () => {
    render(<ChatPanel sessionId="empty" onPrompt={vi.fn()} />);
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  });

  it('unlocks the composer when a streamed run emits done', async () => {
    const listeners: Array<(event: any) => void> = [];
    const subscribe = vi.fn((listener: (event: any) => void) => { listeners.push(listener); return () => undefined; });
    const onPrompt = vi.fn(() => new Promise<void>(() => undefined));
    render(<ChatPanel sessionId="stream" onPrompt={onPrompt} subscribe={subscribe} />);
    const input = screen.getByLabelText('消息');
    fireEvent.change(input, { target: { value: '流式测试' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument());
    act(() => listeners[0]?.({ protocolVersion: 1, type: 'done', sessionId: 'stream', messageId: 'm', provider: 'claude', sequence: 1, occurredAt: new Date().toISOString(), payload: {} }));
    await waitFor(() => expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument());
  });

  it('exposes a busy state while the agent is generating', async () => {
    const onPrompt = vi.fn(() => new Promise<void>(() => undefined));
    render(<ChatPanel sessionId="busy" onPrompt={onPrompt} />);
    fireEvent.change(screen.getByLabelText('消息'), { target: { value: '请处理' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => {
      expect(document.querySelector('.chat-composer')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Agent 正在生成，可点击“停止”中断')).toBeInTheDocument();
    });
  });
});

describe('ChatPanel retry behavior', () => {
  it('retries the last prompt without duplicating the user message', async () => {
    const onPrompt = vi.fn()
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValueOnce(undefined);
    render(<ChatPanel sessionId="retry" onPrompt={onPrompt} />);
    fireEvent.change(screen.getByLabelText('消息'), { target: { value: '再次运行' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('网络错误');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(onPrompt).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText('再次运行')).toHaveLength(1);
  });
});
