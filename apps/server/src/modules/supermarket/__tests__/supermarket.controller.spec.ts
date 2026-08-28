import { SupermarketController } from '../supermarket.controller';

describe('SupermarketController', () => {
  const service = { findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const controller = new SupermarketController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a paginated list', async () => {
    const data = { items: [], meta: { page: 1, pageSize: 10, total: 0 } };
    service.findAll.mockResolvedValue(data);
    await expect(controller.findAll({ page: 1, pageSize: 10, keyword: '端氏' })).resolves.toEqual({ success: true, data });
    expect(service.findAll).toHaveBeenCalledWith(1, 10, '端氏');
  });

  it('returns one supermarket', async () => {
    service.findById.mockResolvedValue({ id: 'super-1' });
    await expect(controller.findOne('super-1')).resolves.toEqual({ success: true, data: { id: 'super-1' } });
    expect(service.findById).toHaveBeenCalledWith('super-1');
  });

  it('creates a supermarket', async () => {
    const body = { name: '端氏' };
    service.create.mockResolvedValue({ id: 'super-1', ...body });
    await expect(controller.create(body)).resolves.toEqual({ success: true, data: { id: 'super-1', ...body } });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('updates a supermarket', async () => {
    const body = { description: '月结客户' };
    service.update.mockResolvedValue({ id: 'super-1', ...body });
    await expect(controller.update('super-1', body)).resolves.toEqual({ success: true, data: { id: 'super-1', ...body } });
    expect(service.update).toHaveBeenCalledWith('super-1', body);
  });

  it('passes through the delete result', async () => {
    service.delete.mockResolvedValue({ success: true, data: null });
    await expect(controller.delete('super-1')).resolves.toEqual({ success: true, data: null });
    expect(service.delete).toHaveBeenCalledWith('super-1');
  });
});
