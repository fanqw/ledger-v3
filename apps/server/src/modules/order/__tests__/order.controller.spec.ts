import { OrderController } from '../order.controller';

describe('OrderController', () => {
  const service = {
    getNextName: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
  };
  const controller = new OrderController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns next order name', async () => {
    service.getNextName.mockResolvedValue({ name: '20260824-01' });
    await expect(controller.nextName()).resolves.toEqual({ success: true, data: { name: '20260824-01' } });
  });

  it('returns a paginated list', async () => {
    const data = { items: [], meta: { page: 1, pageSize: 20, total: 0 } };
    service.findAll.mockResolvedValue(data);
    await expect(controller.findAll({ page: 1, pageSize: 20, keyword: 'x' })).resolves.toEqual({ success: true, data });
    expect(service.findAll).toHaveBeenCalledWith(1, 20, 'x');
  });

  it('returns one order', async () => {
    service.findById.mockResolvedValue({ id: 'order-1' });
    await expect(controller.findOne('order-1')).resolves.toEqual({ success: true, data: { id: 'order-1' } });
    expect(service.findById).toHaveBeenCalledWith('order-1');
  });

  it('creates an order', async () => {
    const body = { name: '测试订单' };
    service.create.mockResolvedValue({ id: 'order-1', ...body });
    await expect(controller.create(body)).resolves.toEqual({ success: true, data: { id: 'order-1', name: '测试订单' } });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('updates an order', async () => {
    const body = { name: '新名字' };
    service.update.mockResolvedValue({ id: 'order-1', name: '新名字' });
    await expect(controller.update('order-1', body)).resolves.toEqual({ success: true, data: { id: 'order-1', name: '新名字' } });
    expect(service.update).toHaveBeenCalledWith('order-1', body);
  });

  it('deletes an order', async () => {
    service.delete.mockResolvedValue({ success: true, data: null });
    await expect(controller.delete('order-1')).resolves.toEqual({ success: true, data: null });
    expect(service.delete).toHaveBeenCalledWith('order-1');
  });

  it('adds an item to an order', async () => {
    const body = { commodityId: 'c1', quantity: 2, unitPrice: 5, lineTotal: 10 };
    service.addItem.mockResolvedValue({ id: 'item-1' });
    await expect(controller.addItem('order-1', body)).resolves.toEqual({ success: true, data: { id: 'item-1' } });
    expect(service.addItem).toHaveBeenCalledWith('order-1', body);
  });

  it('updates an order item', async () => {
    const body = { quantity: 3 };
    service.updateItem.mockResolvedValue({ id: 'item-1', quantity: 3 });
    await expect(controller.updateItem('order-1', 'item-1', body)).resolves.toEqual({ success: true, data: { id: 'item-1', quantity: 3 } });
    expect(service.updateItem).toHaveBeenCalledWith('order-1', 'item-1', body);
  });

  it('deletes an order item', async () => {
    service.deleteItem.mockResolvedValue({ success: true, data: null });
    await expect(controller.deleteItem('order-1', 'item-1')).resolves.toEqual({ success: true, data: null });
    expect(service.deleteItem).toHaveBeenCalledWith('order-1', 'item-1');
  });
});
