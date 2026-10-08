/**
 * Normalizes query pagination parameters and builds mongo skip/limit options
 */
const parsePagination = (query = {}) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100; // Enforce max limit protection

  const skip = (page - 1) * limit;

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' || query.sortOrder === '1' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  return {
    page,
    limit,
    skip,
    sort,
    sortBy,
    sortOrder: sortOrder === 1 ? 'asc' : 'desc',
  };
};

module.exports = {
  parsePagination,
};
