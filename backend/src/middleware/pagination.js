/**
 * Validates and normalizes pagination query parameters.
 *
 * Rules:
 * - page: positive integer >= 1 (defaults to 1)
 * - limit: positive integer between 1 and 100 inclusive (defaults to 20)
 *
 * Disallowed values:
 * - negative numbers, zero
 * - decimals/floats
 * - strings that cannot be parsed as pure positive integers
 * - NaN, Infinity
 *
 * @param {Object} query - Express req.query object
 * @returns {{ valid: true, page: number, limit: number } | { valid: false, error: string }}
 */
export function parsePaginationParams(query = {}) {
  let page = 1;
  let limit = 20;

  // 1. Validate page if provided
  if (query.page !== undefined && query.page !== "") {
    const rawPage = String(query.page).trim();
    // Must be a pure positive integer (digits only, no signs, no decimals, not starting with zero if multi-digit, though regex /^\d+$/ with Number > 0 handles it)
    if (!/^\d+$/.test(rawPage)) {
      return {
        valid: false,
        error: `Invalid page parameter: "${query.page}". Must be a positive integer >= 1.`,
      };
    }

    const parsedPage = Number(rawPage);
    if (!Number.isSafeInteger(parsedPage) || parsedPage < 1) {
      return {
        valid: false,
        error: `Invalid page parameter: "${query.page}". Must be a positive integer >= 1.`,
      };
    }
    page = parsedPage;
  }

  // 2. Validate limit if provided
  if (query.limit !== undefined && query.limit !== "") {
    const rawLimit = String(query.limit).trim();
    if (!/^\d+$/.test(rawLimit)) {
      return {
        valid: false,
        error: `Invalid limit parameter: "${query.limit}". Must be a positive integer between 1 and 100.`,
      };
    }

    const parsedLimit = Number(rawLimit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return {
        valid: false,
        error: `Invalid limit parameter: "${query.limit}". Must be between 1 and 100.`,
      };
    }
    limit = parsedLimit;
  }

  return {
    valid: true,
    page,
    limit,
  };
}

/**
 * Express middleware that validates req.query for pagination.
 * Sets req.pagination = { page, limit } on success, or responds with HTTP 400 INVALID_PAGINATION.
 */
export function validatePaginationMiddleware(req, res, next) {
  const result = parsePaginationParams(req.query);
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PAGINATION",
        message: result.error,
      },
    });
  }

  req.pagination = {
    page: result.page,
    limit: result.limit,
  };

  next();
}
