import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeNumeric, sanitizeObject, escapeHtml } from '@/lib/sanitize'

describe('Sanitize - XSS Prevention', () => {
  describe('sanitizeText', () => {
    it('should escape HTML entities to prevent XSS', () => {
      const result = sanitizeText('<script>alert("xss")</script>')
      expect(result).toContain('&lt;script&gt;')
      expect(result).toContain('alert')
      expect(result).not.toContain('<script>')
    })

    it('should handle null/undefined gracefully', () => {
      expect(sanitizeText(null as any)).toBe('')
      expect(sanitizeText(undefined as any)).toBe('')
    })

    it('should preserve safe text', () => {
      expect(sanitizeText('Hello World')).toBe('Hello World')
      expect(sanitizeText('Patient #123')).toBe('Patient #123')
    })

    it('should trim whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello')
    })
  })

  describe('escapeHtml', () => {
    it('should escape all dangerous characters', () => {
      expect(escapeHtml('<')).toBe('&lt;')
      expect(escapeHtml('>')).toBe('&gt;')
      expect(escapeHtml('&')).toBe('&amp;')
      expect(escapeHtml('"')).toBe('&quot;')
      expect(escapeHtml("'")).toBe('&#x27;')
      expect(escapeHtml('/')).toBe('&#x2F;')
    })

    it('should escape nested tags', () => {
      const result = escapeHtml('<div><span>text</span></div>')
      expect(result).toContain('&lt;div&gt;')
      expect(result).toContain('&lt;span&gt;text&lt;')
      expect(result).not.toContain('<div>')
      expect(result).not.toContain('<span>')
    })
  })

  describe('sanitizeNumeric', () => {
    it('should keep only digits and dots', () => {
      expect(sanitizeNumeric('123.45')).toBe('123.45')
      expect(sanitizeNumeric('abc123')).toBe('123')
      expect(sanitizeNumeric('$1,000.00')).toBe('1000.00')
    })

    it('should handle empty input', () => {
      expect(sanitizeNumeric('')).toBe('')
    })
  })

  describe('sanitizeObject', () => {
    it('should sanitize string values in objects', () => {
      const input = { name: '<script>alert(1)</script>John', age: 30 }
      const result = sanitizeObject(input) as any
      expect(result.name).not.toContain('<script>')
      expect(result.name).toContain('&lt;script&gt;')
      expect(result.age).toBe(30)
    })

    it('should sanitize nested objects', () => {
      const input = { outer: { inner: '<img src=x onerror=alert(1)>' } }
      const result = sanitizeObject(input) as any
      expect(result.outer.inner).toContain('&lt;img')
      expect(result.outer.inner).not.toContain('<img')
    })

    it('should handle arrays', () => {
      const input = ['<script>xss</script>', 'safe text'] as any
      const result = sanitizeObject(input) as any
      expect(result[0]).not.toContain('<script>')
      expect(result[1]).toBe('safe text')
    })
  })
})
