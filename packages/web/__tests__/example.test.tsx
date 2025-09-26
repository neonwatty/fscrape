import { render, screen, createMockPost } from './setup.tsx'
import { describe, it, expect, vi } from 'vitest'

describe('Jest Setup Verification', () => {
  it('should run a basic test', () => {
    expect(true).toBe(true)
  })

  it('should render a component', () => {
    render(<div data-testid="test">Hello Jest</div>)
    const element = screen.getByTestId('test')
    expect(element).toBeInTheDocument()
    expect(element).toHaveTextContent('Hello Jest')
  })

  it('should handle async operations', async () => {
    const promise = Promise.resolve('success')
    const result = await promise
    expect(result).toBe('success')
  })

  it('should mock fetch correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'test' }),
    } as Response)

    const response = await fetch('/api/test')
    const data = await response.json()

    expect(fetch).toHaveBeenCalledWith('/api/test')
    expect(data).toEqual({ data: 'test' })
  })

  it('should use test utilities', () => {
    const post = createMockPost({ title: 'Custom Title' })

    expect(post.title).toBe('Custom Title')
    expect(post.author).toBe('TestAuthor')
    expect(post.score).toBe(100)
  })
})
