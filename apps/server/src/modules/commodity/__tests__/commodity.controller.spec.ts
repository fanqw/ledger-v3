import { CommodityController } from '../commodity.controller';

describe('CommodityController', () => {
  const service = { findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const controller = new CommodityController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a paginated list', async () => {
    const data = { items: [], meta: { page: 2, pageSize: 10, total: 0 } };
    service.findAll.mockResolvedValue(data);
    await expect(controller.findAll({ page: 2, pageSize: 10, keyword: 'rice' })).resolves.toEqual({ success: true, data });
    expect(service.findAll).toHaveBeenCalledWith(2, 10, 'rice', undefined, undefined);
  });

  it('returns one commodity', async () => {
    service.findById.mockResolvedValue({ id: 'commodity-1' });
    await expect(controller.findOne('commodity-1')).resolves.toEqual({ success: true, data: { id: 'commodity-1' } });
    expect(service.findById).toHaveBeenCalledWith('commodity-1');
  });

  it('creates a commodity', async () => {
    const body = { name: 'Rice', categoryId: 'category-1', unitId: 'unit-1' };
    service.create.mockResolvedValue({ id: 'commodity-1', ...body });
    await expect(controller.create(body)).resolves.toEqual({ success: true, data: { id: 'commodity-1', ...body } });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('updates a commodity', async () => {
    const body = { description: 'Grain' };
    service.update.mockResolvedValue({ id: 'commodity-1', ...body });
    await expect(controller.update('commodity-1', body)).resolves.toEqual({ success: true, data: { id: 'commodity-1', ...body } });
    expect(service.update).toHaveBeenCalledWith('commodity-1', body);
  });

  it('passes through the delete result', async () => {
    service.delete.mockResolvedValue({ success: true, data: null });
    await expect(controller.delete('commodity-1')).resolves.toEqual({ success: true, data: null });
    expect(service.delete).toHaveBeenCalledWith('commodity-1');
  });
});
