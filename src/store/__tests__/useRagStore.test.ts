import { useAppStore } from '../index';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRagStore } from '../storeHooks';

// Mock window.rag
const mockGetDocuments = vi.fn();
const mockAddFile = vi.fn();
const mockAddUrl = vi.fn();
const mockRemoveDocument = vi.fn();
const mockOnProgress = vi.fn();

Object.defineProperty(window, 'rag', {
  value: {
    getDocuments: mockGetDocuments,
    addFile: mockAddFile,
    addUrl: mockAddUrl,
    removeDocument: mockRemoveDocument,
    onProgress: mockOnProgress,
  },
  writable: true,
});

describe('useRagStore', () => {
  beforeEach(() => {
    useRagStore.setState({
      documents: [],
      isLoading: false,
      error: null,
      processingStatus: {},
      activeDocumentIds: [],
      isModalOpen: false,
    });
    vi.clearAllMocks();
  });

  it('should load documents successfully', async () => {
    const docs = [{ id: '1', title: 'Test Doc', type: 'file' }];
    mockGetDocuments.mockResolvedValue({ success: true, documents: docs });

    await useAppStore.getState().rag.loadDocuments();

    const state = useAppStore.getState().rag;
    expect(state.documents).toEqual(docs);
    expect(state.isLoading).toBe(false);
    expect(state.activeDocumentIds).toEqual(['1']); // Should select all by default
  });

  it('should handle load documents error', async () => {
    mockGetDocuments.mockResolvedValue({ success: false, error: 'Failed' });

    await useAppStore.getState().rag.loadDocuments();

    const state = useAppStore.getState().rag;
    expect(state.error).toBe('Failed');
    expect(state.isLoading).toBe(false);
  });

  it('should toggle document selection', () => {
    useRagStore.setState({ activeDocumentIds: ['1', '2'] });

    useAppStore.getState().rag.toggleDocumentSelection('1');
    expect(useAppStore.getState().rag.activeDocumentIds).toEqual(['2']);

    useAppStore.getState().rag.toggleDocumentSelection('3');
    expect(useAppStore.getState().rag.activeDocumentIds).toEqual(['2', '3']);
  });

  it('should handle progress events', () => {
    useRagStore
      .getState()
      .handleProgress({ id: '1', status: 'processing', message: 'Work' });

    const state = useAppStore.getState().rag;
    expect(state.processingStatus['1']).toEqual({
      status: 'processing',
      message: 'Work',
    });
  });

  it('should reload documents on completion', async () => {
    mockGetDocuments.mockResolvedValue({ success: true, documents: [] });

    // Trigger progress complete
    useRagStore
      .getState()
      .handleProgress({ id: '1', status: 'indexed', message: 'Done' });

    // Should call getDocuments
    expect(mockGetDocuments).toHaveBeenCalled();
  });
});
