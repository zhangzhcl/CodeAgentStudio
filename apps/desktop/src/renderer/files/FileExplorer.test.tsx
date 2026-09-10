import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { FileExplorer } from './FileExplorer.js';

describe('FileExplorer', () => {
  it('loads a directory lazily and opens a file callback', async () => {
    const onOpenFile = vi.fn();
    const list = vi.fn().mockImplementation((path: string) => path ? Promise.resolve([]) : Promise.resolve([{ name: 'src', path: 'src', isDirectory: true, mtime: 1, size: 0 }]));
    render(<FileExplorer listEntries={list} onOpenFile={onOpenFile} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'src' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'src' }));
    await waitFor(() => expect(list).toHaveBeenCalledWith('src'));
  });

  it('filters default ignored directories', () => {
    const list = vi.fn().mockResolvedValue([]);
    render(<FileExplorer listEntries={list} onOpenFile={vi.fn()} initialEntries={[
      { name: '.git', path: '.git', isDirectory: true, mtime: 1, size: 0 },
      { name: 'dist', path: 'dist', isDirectory: true, mtime: 1, size: 0 },
      { name: 'reference-claudecodeui', path: 'reference-claudecodeui', isDirectory: true, mtime: 1, size: 0 },
      { name: 'README.md', path: 'README.md', isDirectory: false, mtime: 1, size: 10 },
    ]} />);
    expect(screen.queryByRole('button', { name: '.git' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'dist' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'reference-claudecodeui' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'README.md' })).toBeInTheDocument();
  });
});
