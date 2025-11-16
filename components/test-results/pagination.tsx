// Pagination component for test results

import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const handlePrevious = () => {
    if (hasPreviousPage) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (hasNextPage) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    onPageChange(page);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 7;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null; // Don't show pagination if only one page
  }

  return (
    <div className="flex items-center justify-between border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6 rounded-b-lg">
      <div className="flex flex-1 justify-between sm:hidden">
        {/* Mobile pagination */}
        <button
          onClick={handlePrevious}
          disabled={!hasPreviousPage}
          className={`relative inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
            hasPreviousPage
              ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
              : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700'
          }`}
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          disabled={!hasNextPage}
          className={`relative ml-3 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
            hasNextPage
              ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
              : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700'
          }`}
        >
          Next
        </button>
      </div>

      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalCount}</span> files
          </p>
        </div>
        <div>
          <nav
            className="isolate inline-flex -space-x-px rounded-md shadow-sm"
            aria-label="Pagination"
          >
            {/* Previous Button */}
            <button
              onClick={handlePrevious}
              disabled={!hasPreviousPage}
              className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 ${
                hasPreviousPage
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                  : 'cursor-not-allowed opacity-50'
              }`}
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Page Numbers */}
            {getPageNumbers().map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = page as number;
              const isCurrent = pageNum === currentPage;

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageClick(pageNum)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    isCurrent
                      ? 'z-10 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:focus-visible:outline-gray-600'
                      : 'text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              onClick={handleNext}
              disabled={!hasNextPage}
              className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 ${
                hasNextPage
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                  : 'cursor-not-allowed opacity-50'
              }`}
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
