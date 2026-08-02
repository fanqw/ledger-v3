import { UnitController } from '../unit.controller';

describe('UnitController', () => {
  const service = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const controller = new UnitController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a paginated list', async () => {
    const data = { items: [], meta: { page: 2, pageSize: 10, total: 0 } };
    service.findAll.mockResolvedValue(data);
    await expect(controller.findAll({ page: 2, pageSize: 10, keyword: 'kg' })).resolves.toEqual({ success: true, data });
    expect(service.findAll).toHaveBeenCalledWith(2, 10, 'kg');
  });

  it('returns one unit', async () => {
    service.findById.mockResolvedValue({ id: 'unit-1' });
    await expect(controller.findOne('unit-1')).resolves.toEqual({ success: true, data: { id: 'unit-1' } });
    expect(service.findById).toHaveBeenCalledWith('unit-1');
  });

  it('creates a unit', async () => {
    const body = { name: 'kg' };
    service.create.mockResolvedValue({ id: 'unit-1', ...body });
    await expect(controller.create(body)).resolves.toEqual({ success: true, data: { id: 'unit-1', name: 'kg' } });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('updates a unit', async () => {
    const body = { description: 'weight' };
    service.update.mockResolvedValue({ id: 'unit-1', ...body });
    await expect(controller.update('unit-1', body)).resolves.toEqual({ success: true, data: { id: 'unit-1', description: 'weight' } });
    expect(service.update).toHaveBeenCalledWith('unit-1', body);
  });

  it('passes through the delete result', async () => {
    service.delete.mockResolvedValue({ success: true, data: null });
    await expect(controller.delete('unit-1')).resolves.toEqual({ success: true, data: null });
    expect(service.delete).toHaveBeenCalledWith('unit-1');
  });
});
