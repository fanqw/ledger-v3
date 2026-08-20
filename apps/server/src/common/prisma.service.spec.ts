import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('connects when the module initializes', async () => {
    const connect = jest.spyOn(service, '$connect').mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('propagates initialization connection failures', async () => {
    jest.spyOn(service, '$connect').mockRejectedValue(new Error('database unavailable'));

    await expect(service.onModuleInit()).rejects.toThrow('database unavailable');
  });

  it('disconnects when the module is destroyed', async () => {
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('propagates shutdown disconnection failures', async () => {
    jest.spyOn(service, '$disconnect').mockRejectedValue(new Error('disconnect failed'));

    await expect(service.onModuleDestroy()).rejects.toThrow('disconnect failed');
  });
});
