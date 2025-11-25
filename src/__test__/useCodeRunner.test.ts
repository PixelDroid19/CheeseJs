import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { useCodeStore } from '../store/useCodeStore'
import { useWebContainerStore } from '../store/useWebContainerStore'
import { useSettingsStore } from '../store/useSettingsStore'

// Mock the stores
vi.mock('../store/useCodeStore')
vi.mock('../store/useWebContainerStore')
vi.mock('../store/useSettingsStore')
vi.mock('../lib/languageDetector', () => ({
  detectLanguage: vi.fn().mockResolvedValue('javascript')
}))

describe('useCodeRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    const mockSetLanguage = vi.fn()
    const mockSetIsExecuting = vi.fn()
    const mockClearResult = vi.fn()
    const mockSetResult = vi.fn()
    const mockSetCode = vi.fn()
    const mockAppendResult = vi.fn()

    vi.mocked(useCodeStore).mockImplementation((selector: any) => {
      const state = {
        code: 'console.log("test")',
        setCode: mockSetCode,
        setResult: mockSetResult,
        appendResult: mockAppendResult,
        clearResult: mockClearResult,
        language: 'javascript',
        setLanguage: mockSetLanguage,
        setIsExecuting: mockSetIsExecuting,
        result: [],
        isExecuting: false
      }
      return selector(state)
    })

    vi.mocked(useWebContainerStore).mockReturnValue({
      webContainer: null,
      isLoading: false,
      error: null,
      bootWebContainer: vi.fn()
    } as any)

    vi.mocked(useSettingsStore).mockReturnValue({
      showTopLevelResults: true,
      loopProtection: true,
      showUndefined: true,
      themeName: 'onedark',
      fontSize: 14,
      alignResults: true
    } as any)
  })

  it('should initialize without errors', () => {
    const { result } = renderHook(() => useCodeRunner())
    expect(result.current).toBeDefined()
    expect(result.current.runCode).toBeInstanceOf(Function)
  })

  it('should set isExecuting to true when running code', async () => {
    const mockSetIsExecuting = vi.fn()
    const mockSetLanguage = vi.fn()
    const mockClearResult = vi.fn()
    const mockSetResult = vi.fn()

    vi.mocked(useCodeStore).mockImplementation((selector: any) => {
      const state = {
        code: 'const x = 1',
        setCode: vi.fn(),
        setResult: mockSetResult,
        appendResult: vi.fn(),
        clearResult: mockClearResult,
        language: 'javascript',
        setLanguage: mockSetLanguage,
        setIsExecuting: mockSetIsExecuting,
        result: [],
        isExecuting: false
      }
      return selector(state)
    })

    const { result } = renderHook(() => useCodeRunner())

    await result.current.runCode()

    expect(mockSetIsExecuting).toHaveBeenCalledWith(true)
    expect(mockSetIsExecuting).toHaveBeenCalledWith(false)
  })

  it('should clear results before execution', async () => {
    const mockClearResult = vi.fn()
    const mockSetIsExecuting = vi.fn()
    const mockSetLanguage = vi.fn()
    const mockSetResult = vi.fn()

    vi.mocked(useCodeStore).mockImplementation((selector: any) => {
      const state = {
        code: 'const x = 1',
        setCode: vi.fn(),
        setResult: mockSetResult,
        appendResult: vi.fn(),
        clearResult: mockClearResult,
        language: 'javascript',
        setLanguage: mockSetLanguage,
        setIsExecuting: mockSetIsExecuting,
        result: [],
        isExecuting: false
      }
      return selector(state)
    })

    const { result } = renderHook(() => useCodeRunner())

    await result.current.runCode()

    expect(mockClearResult).toHaveBeenCalled()
  })
})
