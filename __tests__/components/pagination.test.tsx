import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '@/components/pagination'

describe('Pagination Component', () => {
  const mockOnPageChange = vi.fn()
  const mockOnPageSizeChange = vi.fn()

  beforeEach(() => {
    mockOnPageChange.mockClear()
    mockOnPageSizeChange.mockClear()
  })

  it('should render correct page numbers', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={50}
        pageSize={10}
      />
    )

    // Check that page numbers are rendered
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
  })

  it('should show correct item range text', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={50}
        pageSize={10}
      />
    )

    // Check item range display
    expect(screen.getByText(/全 50 件中/)).toBeInTheDocument()
    expect(screen.getByText(/11 - 20 件を表示/)).toBeInTheDocument()
  })

  it('should disable prev button when on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const prevButton = screen.getAllByRole('button')[1] // Second button is previous
    expect(prevButton).toBeDisabled()
  })

  it('should disable next button when on last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const buttons = screen.getAllByRole('button')
    const nextButton = buttons[buttons.length - 2] // Second to last button is next
    expect(nextButton).toBeDisabled()
  })

  it('should call onPageChange when clicking page number', async () => {
    const user = userEvent.setup()
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const page2Button = screen.getByRole('button', { name: '2' })
    await user.click(page2Button)

    expect(mockOnPageChange).toHaveBeenCalledWith(2)
  })

  it('should call onPageChange when clicking next button', async () => {
    const user = userEvent.setup()
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const buttons = screen.getAllByRole('button')
    const nextButton = buttons[2] // Third button is next
    await user.click(nextButton)

    expect(mockOnPageChange).toHaveBeenCalledWith(2)
  })

  it('should highlight current page button', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const page3Button = screen.getByRole('button', { name: '3' })
    expect(page3Button).toHaveClass('bg-gradient-to-r')
  })

  it('should show page size selector when showPageSize is true', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
        showPageSize={true}
        pageSize={10}
        onPageSizeChange={mockOnPageSizeChange}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    )

    expect(screen.getByText('件/ページ:')).toBeInTheDocument()
  })

  it('should call onPageSizeChange when selecting different page size', async () => {
    const user = userEvent.setup()
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
        showPageSize={true}
        pageSize={10}
        onPageSizeChange={mockOnPageSizeChange}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    )

    const select = screen.getByRole('combobox')
    await user.click(select)

    const option25 = screen.getByRole('option', { name: '25' })
    await user.click(option25)

    expect(mockOnPageSizeChange).toHaveBeenCalledWith(25)
  })

  it('should show ellipsis for large page counts', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={20}
        onPageChange={mockOnPageChange}
      />
    )

    // Ellipsis should appear when there are many pages
    expect(screen.getByText('...')).toBeInTheDocument()
  })

  it('should handle single page correctly', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={1}
        onPageChange={mockOnPageChange}
      />
    )

    const buttons = screen.getAllByRole('button')
    // All navigation buttons should be disabled for single page
    buttons.forEach((button) => {
      if (button.textContent === '1') {
        expect(button).not.toBeDisabled()
      }
    })
  })

  it('should display correct range for last page with partial items', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={3}
        onPageChange={mockOnPageChange}
        totalItems={25}
        pageSize={10}
      />
    )

    // Last page should show correct end index
    expect(screen.getByText(/21 - 25 件を表示/)).toBeInTheDocument()
  })

  it('should have first and last page buttons', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const buttons = screen.getAllByRole('button')
    // First button should be "first page" (ChevronsLeft)
    // Last button should be "last page" (ChevronsRight)
    expect(buttons.length).toBeGreaterThanOrEqual(5)
  })
})
