import { CategoryController } from '../category.controller';

describe('CategoryController', () => {
  const service = { findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const controller = new CategoryController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a paginated list', async () => {
    const data = { items: [], meta: { page: 2, pageSize: 10, total: 0 } };
    service.findAll.mockResolvedValue(data);
    await expect(controller.findAll({ page: 2, pageSize: 10, keyword: 'food' })).resolves.toEqual({ success: true, data });
    expect(service.findAll).toHaveBeenCalledWith(2, 10, 'food', undefined, undefined);
  });

  it('returns one category', async () => {
    service.findById.mockResolvedValue({ id: 'category-1' });
    await expect(controller.findOne('category-1')).resolves.toEqual({ success: true, data: { id: 'category-1' } });
    expect(service.findById).toHaveBeenCalledWith('category-1');
  });

  it('creates a category', async () => {
    const body = { name: 'Food' };
    service.create.mockResolvedValue({ id: 'category-1', ...body });
    await expect(controller.create(body)).resolves.toEqual({ success: true, data: { id: 'category-1', ...body } });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('updates a category', async () => {
    const body = { description: 'Groceries' };
    service.update.mockResolvedValue({ id: 'category-1', ...body });
    await expect(controller.update('category-1', body)).resolves.toEqual({ success: true, data: { id: 'category-1', ...body } });
    expect(service.update).toHaveBeenCalledWith('category-1', body);
  });

  it('passes through the delete result', async () => {
    service.delete.mockResolvedValue({ success: true, data: null });
    await expect(controller.delete('category-1')).resolves.toEqual({ success: true, data: null });
    expect(service.delete).toHaveBeenCalledWith('category-1');
  });
});
