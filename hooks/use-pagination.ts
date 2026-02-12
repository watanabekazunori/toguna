import { useState, useMemo } from 'react'

export interface UsePaginationResult<T> {
  paginatedItems: T[]
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  goToFirstPage: () => void
  goToLastPage: () => void
  goToNextPage: () => void
  goToPreviousPage: () => void
}

/**
 * Hook for managing pagination of items
 * @param items - Array of items to paginate
 * @param initialPageSize - Initial page size (default: 10)
 * @returns Pagination state and control functions
 */
export function usePagination<T>(items: T[], initialPageSize = 10): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Ensure current page is within valid range
  const validCurrentPage = Math.min(currentPage, totalPages)

  // Calculate paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return items.slice(startIndex, endIndex)
  }, [items, validCurrentPage, pageSize])

  // Handle page size change - reset to first page
  const handleSetPageSize = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  // Handle page change with boundary validation
  const handleSetCurrentPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }

  const goToFirstPage = () => handleSetCurrentPage(1)
  const goToLastPage = () => handleSetCurrentPage(totalPages)
  const goToNextPage = () => handleSetCurrentPage(validCurrentPage + 1)
  const goToPreviousPage = () => handleSetCurrentPage(validCurrentPage - 1)

  return {
    paginatedItems,
    currentPage: validCurrentPage,
    totalPages,
    pageSize,
    totalItems,
    setCurrentPage: handleSetCurrentPage,
    setPageSize: handleSetPageSize,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
  }
}
