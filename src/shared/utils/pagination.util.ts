/**
 * Pagination Utilities
 * Helper functions for handling pagination
 */

import { PaginationConfig } from '../../config/constants.js';
import { PaginationParams, PaginationMeta, PaginationQuery } from '../types/index.js';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_PAGE = PaginationConfig.DEFAULT_PAGE;
const DEFAULT_LIMIT = PaginationConfig.DEFAULT_LIMIT;
const MAX_LIMIT = PaginationConfig.MAX_LIMIT;

// ============================================
// PAGINATION PARSING
// ============================================

/**
 * Parse pagination parameters from query string
 * @param query - Query object containing page and limit
 * @returns Parsed pagination parameters with skip value
 */
export function parsePaginationParams(query: PaginationQuery): PaginationParams {
  // Parse page
  let page: number = DEFAULT_PAGE;
  if (query.page !== undefined) {
    const parsedPage = typeof query.page === 'string'
      ? parseInt(query.page, 10)
      : query.page;
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  // Parse limit
  let limit: number = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    const parsedLimit = typeof query.limit === 'string'
      ? parseInt(query.limit, 10)
      : query.limit;
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, MAX_LIMIT);
    }
  }

  // Calculate skip
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Parse pagination with custom defaults
 */
export function parsePaginationWithDefaults(
  query: PaginationQuery,
  defaultLimit: number = DEFAULT_LIMIT,
  maxLimit: number = MAX_LIMIT
): PaginationParams {
  let page: number = DEFAULT_PAGE;
  if (query.page !== undefined) {
    const parsedPage = typeof query.page === 'string'
      ? parseInt(query.page, 10)
      : query.page;
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  let limit: number = defaultLimit;
  if (query.limit !== undefined) {
    const parsedLimit = typeof query.limit === 'string'
      ? parseInt(query.limit, 10)
      : query.limit;
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, maxLimit);
    }
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// ============================================
// PAGINATION METADATA
// ============================================

/**
 * Create pagination metadata object
 * @param total - Total number of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Pagination metadata
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Create pagination meta with additional info
 */
export function createExtendedPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta & { from: number; to: number } {
  const meta = createPaginationMeta(total, page, limit);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return {
    ...meta,
    from,
    to,
  };
}

// ============================================
// MONGOOSE PAGINATION HELPERS
// ============================================

/**
 * MongoDB aggregation pagination stages
 */
export function getAggregationPaginationStages(params: PaginationParams): object[] {
  return [
    { $skip: params.skip },
    { $limit: params.limit },
  ];
}

/**
 * Create MongoDB aggregation facet for pagination
 * Returns both data and count in a single query
 */
export function getPaginationFacet(params: PaginationParams): object {
  return {
    $facet: {
      data: [
        { $skip: params.skip },
        { $limit: params.limit },
      ],
      count: [
        { $count: 'total' },
      ],
    },
  };
}

/**
 * Parse facet result into data and total
 */
export function parseFacetResult<T>(
  result: Array<{ data: T[]; count: Array<{ total: number }> }>
): { data: T[]; total: number } {
  if (!result || result.length === 0) {
    return { data: [], total: 0 };
  }

  const facetResult = result[0];
  const data = facetResult.data ?? [];
  const total = facetResult.count?.[0]?.total ?? 0;

  return { data, total };
}

// ============================================
// CURSOR-BASED PAGINATION
// ============================================

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction: 'forward' | 'backward';
}

export interface CursorPaginationMeta {
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

/**
 * Parse cursor pagination parameters
 */
export function parseCursorPaginationParams(query: {
  cursor?: string;
  limit?: string | number;
  direction?: 'forward' | 'backward';
}): CursorPaginationParams {
  let limit: number = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    const parsedLimit = typeof query.limit === 'string'
      ? parseInt(query.limit, 10)
      : query.limit;
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, MAX_LIMIT);
    }
  }

  return {
    cursor: query.cursor,
    limit,
    direction: query.direction ?? 'forward',
  };
}

/**
 * Create cursor pagination metadata
 */
export function createCursorPaginationMeta<T extends { _id: { toString(): string } }>(
  items: T[],
  limit: number,
  hasMore: boolean
): CursorPaginationMeta {
  const meta: CursorPaginationMeta = {
    hasMore,
  };

  if (items.length > 0) {
    const lastItem = items[items.length - 1];
    const firstItem = items[0];

    if (hasMore) {
      meta.nextCursor = Buffer.from(lastItem._id.toString()).toString('base64');
    }

    meta.prevCursor = Buffer.from(firstItem._id.toString()).toString('base64');
  }

  return meta;
}

/**
 * Decode cursor to ObjectId string
 */
export function decodeCursor(cursor: string): string | null {
  try {
    return Buffer.from(cursor, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Encode ObjectId to cursor
 */
export function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64');
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate and normalize pagination parameters
 */
export function normalizePaginationParams(
  page?: number,
  limit?: number
): { page: number; limit: number; skip: number } {
  const normalizedPage = Math.max(1, page ?? DEFAULT_PAGE);
  const normalizedLimit = Math.min(Math.max(1, limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const skip = (normalizedPage - 1) * normalizedLimit;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip,
  };
}

/**
 * Get pagination defaults
 */
export function getPaginationDefaults(): { page: number; limit: number; maxLimit: number } {
  return {
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
  };
}
