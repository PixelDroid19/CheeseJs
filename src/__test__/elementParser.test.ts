import { describe, it, expect } from 'vitest'
import { stringify, flattenColoredElement, Colors } from '../lib/elementParser'

describe('elementParser', () => {
  describe('stringify', () => {
    it('should handle boolean true', async () => {
      const result = await stringify(true)
      expect(result).toEqual({
        content: 'true',
        color: Colors.TRUE
      })
    })

    it('should handle boolean false', async () => {
      const result = await stringify(false)
      expect(result).toEqual({
        content: 'false',
        color: Colors.FALSE
      })
    })

    it('should handle numbers', async () => {
      const result = await stringify(42)
      expect(result).toEqual({
        content: '42',
        color: Colors.NUMBER
      })
    })

    it('should handle strings', async () => {
      const result = await stringify('hello')
      expect(result).toEqual({
        content: '"hello"',
        color: Colors.STRING
      })
    })

    it('should handle null', async () => {
      const result = await stringify(null)
      expect(result).toEqual({
        content: 'null',
        color: Colors.GRAY
      })
    })

    it('should handle undefined', async () => {
      const result = await stringify(undefined)
      expect(result).toEqual({
        content: 'undefined',
        color: Colors.GRAY
      })
    })

    it('should handle bigint', async () => {
      const result = await stringify(BigInt(123))
      expect(result).toEqual({
        content: '123n',
        color: Colors.NUMBER
      })
    })

    it('should handle arrays', async () => {
      const result = await stringify([1, 2, 3])
      expect(result.content).toContain('1')
      expect(result.content).toContain('2')
      expect(result.content).toContain('3')
    })

    it('should handle objects', async () => {
      const result = await stringify({ foo: 'bar' })
      expect(result.content).toContain('foo')
      expect(result.content).toContain('bar')
      expect(result.color).toBe(Colors.GRAY)
    })

    it('should handle resolved promises', async () => {
      const promise = Promise.resolve(42)
      const result = await stringify(promise)
      expect(result.content).toContain('Promise')
      expect(result.content).toContain('<pending>')
    })

    it('should handle rejected promises', async () => {
      const promise = Promise.reject(new Error('test error'))
      promise.catch(() => {}) // Handle rejection
      const result = await stringify(promise)
      expect(result.content).toContain('Promise')
      expect(result.content).toContain('<pending>')
      expect(result.color).toBe(Colors.GRAY)
    })

    it('should handle Response objects from promises', async () => {
      // Mock Response object
      const mockResponse = {
        status: 200,
        headers: new Headers(),
        text: async () => 'mock response'
      }
      const promise = Promise.resolve(mockResponse)
      const result = await stringify(promise)
      expect(result.content).toContain('Promise')
      expect(result.content).toContain('<pending>')
    })
  })

  describe('flattenColoredElement', () => {
    it('should flatten simple string element', () => {
      const element = {
        content: 'test',
        color: Colors.STRING
      }
      const result = flattenColoredElement(element)
      expect(result).toEqual([
        {
          content: 'test',
          color: Colors.STRING
        }
      ])
    })

    it('should flatten nested elements', () => {
      const element = {
        content: [
          { content: 'a', color: Colors.STRING },
          { content: 'b', color: Colors.NUMBER }
        ]
      }
      const result = flattenColoredElement(element)
      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('a')
      expect(result[1].content).toBe('b')
    })
  })
})
