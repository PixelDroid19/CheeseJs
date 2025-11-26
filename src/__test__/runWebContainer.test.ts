import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runInWebContainer } from '../lib/code/runWebContainer'
import { usePackagesStore } from '../store/usePackagesStore'

// Mock the store
vi.mock('../store/usePackagesStore', () => ({
  usePackagesStore: {
    getState: vi.fn()
  }
}))

// Mock elementParser
vi.mock('../elementParser', () => ({
  Colors: {
    GRAY: 'gray',
    ERROR: 'error',
    STRING: 'string'
  }
}))

// Mock run
vi.mock('./run', () => ({
  transformCode: vi.fn((code) => code)
}))

// Mock dependencies
vi.mock('./dependencies', () => ({
  getImports: vi.fn(() => [])
}))

describe('runInWebContainer', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWebContainer: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockWebContainer = {
      fs: {
        writeFile: vi.fn(),
      },
      spawn: vi.fn().mockResolvedValue({
        output: {
          pipeTo: vi.fn(),
        },
        kill: vi.fn(),
      }),
    }

    // Mock store state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(usePackagesStore.getState).mockReturnValue({
      packages: [],
    } as any)
  })

  it('should write .npmrc if provided', async () => {
    const code = 'console.log("hello")'
    const npmRcContent = 'registry=https://custom.registry/'
    const onResult = vi.fn()

    await runInWebContainer(
      mockWebContainer,
      code,
      onResult,
      { npmRcContent }
    )

    expect(mockWebContainer.fs.writeFile).toHaveBeenCalledWith('.npmrc', npmRcContent)
  })

  it('should not write .npmrc if not provided', async () => {
    const code = 'console.log("hello")'
    const onResult = vi.fn()

    await runInWebContainer(
      mockWebContainer,
      code,
      onResult,
      {}
    )

    expect(mockWebContainer.fs.writeFile).not.toHaveBeenCalledWith('.npmrc', expect.anything())
  })
})
