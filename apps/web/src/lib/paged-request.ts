interface PagedPayload<T> {
  success: boolean;
  data: {
    items: T[];
    meta: { page: number; pageSize: number; total: number };
  };
}

export async function fetchAllPages<T>(
  requestPage: (page: number, pageSize: number) => Promise<Response>,
  pageSize: number,
): Promise<T[]> {
  const firstJson = await requestPage(1, pageSize).then((res) => res.json() as Promise<PagedPayload<T>>);
  if (!firstJson.success) return [];

  const { items, meta } = firstJson.data;
  const pageCount = Math.max(1, Math.ceil(meta.total / pageSize));
  if (pageCount <= 1) return items;

  const pages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      requestPage(index + 2, pageSize).then((res) => res.json() as Promise<PagedPayload<T>>),
    ),
  );

  return [...items, ...pages.flatMap((page) => (page.success ? page.data.items : []))];
}
