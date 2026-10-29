export function pageArgs(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total };
}

/**
 * Разбор параметра сортировки вида "name" или "-name".
 * Если поле не входит в белый список, используется значение по умолчанию.
 */
export function parseSort(
  sort: string | undefined,
  allowed: string[],
  fallback: string,
): Record<string, 'asc' | 'desc'> {
  const value = sort && allowed.includes(sort.replace(/^-/, '')) ? sort : fallback;
  const desc = value.startsWith('-');
  const field = value.replace(/^-/, '');
  return { [field]: desc ? 'desc' : 'asc' };
}
