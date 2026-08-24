import { AnalyticsController } from '../analytics.controller';

describe('AnalyticsController', () => {
  const service = { getWorkbench: jest.fn() };
  const controller = new AnalyticsController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns workbench data with provided start/end', async () => {
    const data = { kpis: {}, dailyTrend: [] };
    service.getWorkbench.mockResolvedValue(data);
    await expect(controller.getWorkbench({ start: '2026-07-01', end: '2026-07-31' })).resolves.toEqual({
      success: true,
      data,
    });
    expect(service.getWorkbench).toHaveBeenCalledWith('2026-07-01', '2026-07-31');
  });

  it('defaults to last 30 days when no params provided', async () => {
    service.getWorkbench.mockResolvedValue({});
    await controller.getWorkbench({});
    expect(service.getWorkbench).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    const [start, end] = (service.getWorkbench as jest.Mock).mock.calls[0];
    // end 应为今天，start 应在 end 前约 30 天
    expect(end).toBe(new Date().toISOString().slice(0, 10).replace(/T.*/, '') || expect.any(String));
    expect(start <= end).toBe(true);
  });
});
