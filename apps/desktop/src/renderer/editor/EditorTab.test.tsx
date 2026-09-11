import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { EditorTab } from './EditorTab.js';

describe('EditorTab', () => {
  it('marks edits dirty and saves through the callback', async () => {
    const onSave = vi.fn();
    render(<EditorTab path="README.md" content="hello" onSave={onSave} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'README.md' }), { target: { value: 'updated' } });
    expect(screen.getByText('未保存')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith('updated');
    await waitFor(() => expect(screen.queryByText('保存中…')).not.toBeInTheDocument());
  });
});
