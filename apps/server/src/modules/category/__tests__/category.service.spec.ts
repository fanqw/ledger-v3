import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from '../category.service';
import { PrismaService } from '../../../common/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('CategoryService', () => {
  let service: CategoryService;

  const mockPrisma = {
    category: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    commodity: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated categories', async () => {
      const mockData = [{ id: '1', name: '蔬菜', description: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }];
      mockPrisma.category.findMany.mockResolvedValue(mockData);
      mockPrisma.category.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by keyword', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.category.count.mockResolvedValue(0);

      await service.findAll(1, 20, '蔬菜');
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: '蔬菜', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue({ id: '1', name: '蔬菜', description: null });

      const result = await service.create({ name: '蔬菜' });
      expect(result.name).toBe('蔬菜');
    });

    it('should throw on duplicate name', async () => {
      mockPrisma.category.findFirst.mockResolvedValue({ id: 'existing', name: '蔬菜' });

      await expect(service.create({ name: '蔬菜' })).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete when no linked commodities', async () => {
      mockPrisma.category.findFirst.mockResolvedValue({ id: '1', name: '蔬菜', deletedAt: null });
      mockPrisma.commodity.count.mockResolvedValue(0);
      mockPrisma.category.update.mockResolvedValue({ id: '1', name: '蔬菜', deletedAt: new Date() });

      const result = await service.delete('1');
      expect(result).toEqual({ success: true, data: null });
    });

    it('should throw when linked commodities exist', async () => {
      mockPrisma.category.findFirst.mockResolvedValue({ id: '1', name: '蔬菜', deletedAt: null });
      mockPrisma.commodity.count.mockResolvedValue(1);

      await expect(service.delete('1')).rejects.toThrow(ConflictException);
    });

    it('should throw when not found', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);
      await expect(service.delete('999')).rejects.toThrow(NotFoundException);
    });
  });
});
