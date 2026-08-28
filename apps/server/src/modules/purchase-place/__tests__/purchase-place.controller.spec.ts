import { PurchasePlaceController } from '../purchase-place.controller';

describe('PurchasePlaceController', () => {
  const service = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const controller = new PurchasePlaceController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a paginated list', async () => {
    const data = { items: [], meta: { page: 2, pageSize: 10, total: 0 } };
    service.findAll.mockResolvedValue(data);
    await expect(controller.findAll({ page: 2, pageSize: 10, keyword: 'market' })).resolves.toEqual({ success: true, data });
    expect(service.findAll).toHaveBeenCalledWith(2, 10, 'market', undefined, undefined);
  });

  it('returns one purchase place', async () => {
    service.findById.mockResolvedValue({ id: 'place-1' });
    await expect(controller.findOne('place-1')).resolves.toEqual({ success: true, data: { id: 'place-1' } });
    expect(service.findById).toHaveBeenCalledWith('place-1');
  });

  it('creates a purchase place', async () => {
    const body = { place: 'North', marketName: 'Central' };
    service.create.mockResolvedValue({ id: 'place-1', ...body });
    await expect(controller.create(body)).resolves.toEqual({ success: true, data: { id: 'place-1', ...body } });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('updates a purchase place', async () => {
    const body = { description: 'Main market' };
    service.update.mockResolvedValue({ id: 'place-1', ...body });
    await expect(controller.update('place-1', body)).resolves.toEqual({ success: true, data: { id: 'place-1', ...body } });
    expect(service.update).toHaveBeenCalledWith('place-1', body);
  });

  it('passes through the delete result', async () => {
    service.delete.mockResolvedValue({ success: true, data: null });
    await expect(controller.delete('place-1')).resolves.toEqual({ success: true, data: null });
    expect(service.delete).toHaveBeenCalledWith('place-1');
  });
});
