import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel } from './ChatPanel.js';
describe('ChatPanel', () => { it('sends a prompt and renders it optimistically', async () => { const onPrompt = vi.fn(); render(<ChatPanel sessionId="s" onPrompt={onPrompt} />); fireEvent.change(screen.getByLabelText('消息'), { target: { value: '你好' } }); fireEvent.click(screen.getByRole('button', { name: '发送' })); await waitFor(() => expect(onPrompt).toHaveBeenCalledWith('你好')); expect(screen.getByText('你好')).toBeInTheDocument(); }); });
