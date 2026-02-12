import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from '@/hooks/use-pagination'

describe('usePagination Hook', () => {
  it('should initialize with correct default values', () => {
    const items = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    expect(result.current.currentPage).toBe(1)
    expect(result.current.pageSize).toBe(10)
    expect(result.current.totalItems).toBe(25)
    expect(result.current.totalPages).toBe(3)
    expect(result.current.paginatedItems).toHaveLength(10)
  })

  it('should paginate items correctly', () => {
    const items = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    // First page
    expect(result.current.paginatedItems).toEqual(
      Array.from({ length: 10 }, (_, i) => `item-${i + 1}`)
    )

    // Move to second page
    act(() => {
      result.current.setCurrentPage(2)
    })

    expect(result.current.paginatedItems).toEqual(
      Array.from({ length: 10 }, (_, i) => `item-${i + 11}`)
    )

    // Move to third page
    act(() => {
      result.current.setCurrentPage(3)
    })

    expect(result.current.paginatedItems).toEqual(['item-21', 'item-22', 'item-23', 'item-24', 'item-25'])
  })

  it('should handle page change', () => {
    const items = Array.from({ length: 30 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    act(() => {
      result.current.setCurrentPage(2)
    })

    expect(result.current.currentPage).toBe(2)
    expect(result.current.paginatedItems[0]).toBe('item-11')
  })

  it('should handle page size change', () => {
    const items = Array.from({ length: 50 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    expect(result.current.totalPages).toBe(5)

    act(() => {
      result.current.setPageSize(25)
    })

    expect(result.current.pageSize).toBe(25)
    expect(result.current.totalPages).toBe(2)
    expect(result.current.currentPage).toBe(1) // Should reset to first page
    expect(result.current.paginatedItems).toHaveLength(25)
  })

  it('should not allow page less than 1', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    act(() => {
      result.current.setCurrentPage(0)
    })

    expect(result.current.currentPage).toBe(1)
  })

  it('should not allow page greater than totalPages', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    act(() => {
      result.current.setCurrentPage(10)
    })

    expect(result.current.currentPage).toBe(2)
  })

  it('should handle goToFirstPage', () => {
    const items = Array.from({ length: 30 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    act(() => {
      result.current.setCurrentPage(3)
    })

    expect(result.current.currentPage).toBe(3)

    act(() => {
      result.current.goToFirstPage()
    })

    expect(result.current.currentPage).toBe(1)
  })

  it('should handle goToLastPage', () => {
    const items = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    act(() => {
      result.current.goToLastPage()
    })

    expect(result.current.currentPage).toBe(3)
    expect(result.current.paginatedItems).toHaveLength(5)
  })

  it('should handle goToNextPage', () => {
    const items = Array.from({ length: 30 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    expect(result.current.currentPage).toBe(1)

    act(() => {
      result.current.goToNextPage()
    })

    expect(result.current.currentPage).toBe(2)

    act(() => {
      result.current.goToNextPage()
    })

    expect(result.current.currentPage).toBe(3)
  })

  it('should handle goToPreviousPage', () => {
    const items = Array.from({ length: 30 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    act(() => {
      result.current.setCurrentPage(3)
    })

    expect(result.current.currentPage).toBe(3)

    act(() => {
      result.current.goToPreviousPage()
    })

    expect(result.current.currentPage).toBe(2)
  })

  it('should handle empty items array', () => {
    const { result } = renderHook(() => usePagination([], 10))

    expect(result.current.totalItems).toBe(0)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.paginatedItems).toEqual([])
  })

  it('should update paginated items when source items change', () => {
    const initialItems = Array.from({ length: 10 }, (_, i) => `item-${i + 1}`)

    const { result, rerender } = renderHook(
      ({ items, pageSize }) => usePagination(items, pageSize),
      {
        initialProps: { items: initialItems, pageSize: 5 },
      }
    )

    expect(result.current.paginatedItems).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
    expect(result.current.totalItems).toBe(10)

    const newItems = Array.from({ length: 20 }, (_, i) => `new-item-${i + 1}`)
    rerender({ items: newItems, pageSize: 5 })

    expect(result.current.paginatedItems).toEqual([
      'new-item-1',
      'new-item-2',
      'new-item-3',
      'new-item-4',
      'new-item-5',
    ])
    expect(result.current.totalItems).toBe(20)
  })

  it('should not go beyond last page on goToNextPage', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    act(() => {
      result.current.setCurrentPage(2)
    })

    act(() => {
      result.current.goToNextPage()
    })

    // Should stay at last page
    expect(result.current.currentPage).toBe(2)
  })

  it('should not go before first page on goToPreviousPage', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item-${i + 1}`)

    const { result } = renderHook(() => usePagination(items, 10))

    act(() => {
      result.current.goToPreviousPage()
    })

    // Should stay at first page
    expect(result.current.currentPage).toBe(1)
  })
})
