import { MarketController } from '../market.controller';

describe('MarketController', () => {
  const service = { findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const controller = new MarketController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a paginated list', async () => {
    const data = { items: [], meta: { page: 1, pageSize: 10, total: 0 } };
    service.findAll.mockResolvedValue(data);
    await expect(controller.findAll({ page: 1, pageSize: 10, keyword: '长治' })).resolves.toEqual({ success: true, data });
    expect(service.findAll).toHaveBeenCalledWith(1, 10, '长治', undefined, undefined);
  });

  it('returns one market', async () => {
    service.findById.mockResolvedValue({ id: 'market-1' });
    await expect(controller.findOne('market-1')).resolves.toEqual({ success: true, data: { id: 'market-1' } });
    expect(service.findById).toHaveBeenCalledWith('market-1');
  });

  it('creates a market', async () => {
    const body = { name: '长治市场', cityId: 'city-1' };
    service.create.mockResolvedValue({ id: 'market-1', ...body });
    await expect(controller.create(body)).resolves.toEqual({ success: true, data: { id: 'market-1', ...body } });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('updates a market', async () => {
    const body = { description: '主产区' };
    service.update.mockResolvedValue({ id: 'market-1', ...body });
    await expect(controller.update('market-1', body)).resolves.toEqual({ success: true, data: { id: 'market-1', ...body } });
    expect(service.update).toHaveBeenCalledWith('market-1', body);
  });

  it('passes through the delete result', async () => {
    service.delete.mockResolvedValue({ success: true, data: null });
    await expect(controller.delete('market-1')).resolves.toEqual({ success: true, data: null });
    expect(service.delete).toHaveBeenCalledWith('market-1');
  });
});
