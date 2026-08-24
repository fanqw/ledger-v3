import { toDeletedAt, toDate, toHexId, mapFields } from './migrate-from-v1';

describe('migrate-from-v1 转换函数', () => {
  describe('toDeletedAt', () => {
    it('deleted=true 时返回 updatedAt', () => {
      const d = new Date('2024-01-01T00:00:00Z');
      expect(toDeletedAt({ _id: 'a', deleted: true, update_at: d })).toEqual(d);
    });

    it('deleted=false 时返回 null', () => {
      expect(toDeletedAt({ _id: 'a', deleted: false })).toBeNull();
    });

    it('deleted 缺失时返回 null', () => {
      expect(toDeletedAt({ _id: 'a' })).toBeNull();
    });
  });

  describe('toDate', () => {
    it('接受 Date', () => {
      const d = new Date('2024-06-01T00:00:00Z');
      expect(toDate(d)).toEqual(d);
    });

    it('接受 ISO 字符串', () => {
      const d = toDate('2024-06-01T00:00:00Z');
      expect(d?.toISOString()).toBe('2024-06-01T00:00:00.000Z');
    });

    it('空值返回 null', () => {
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
    });

    it('非法字符串返回 null', () => {
      expect(toDate('not-a-date')).toBeNull();
    });
  });

  describe('toHexId', () => {
    it('ObjectId 对象转为 hex 字符串', () => {
      const oid = { toString: () => '507f1f77bcf86cd799439011' };
      expect(toHexId(oid)).toBe('507f1f77bcf86cd799439011');
    });

    it('字符串原样返回', () => {
      expect(toHexId('abc123')).toBe('abc123');
    });

    it('空值返回空字符串', () => {
      expect(toHexId(null)).toBe('');
      expect(toHexId(undefined)).toBe('');
    });
  });

  describe('mapFields', () => {
    it('映射 desc/count/price/create_at/update_at', () => {
      const result = mapFields({
        _id: 'x',
        name: '商品',
        desc: '备注',
        count: 3,
        price: 5.5,
        create_at: '2024-01-01',
        update_at: '2024-01-02',
      });
      expect(result.description).toBe('备注');
      expect(result.quantity).toBe(3);
      expect(result.unitPrice).toBe(5.5);
      expect(result.createdAt).toBe('2024-01-01');
      expect(result.updatedAt).toBe('2024-01-02');
      // _id 不进入映射结果（单独处理）
      expect(result._id).toBeUndefined();
      // 未映射字段保留原名
      expect(result.name).toBe('商品');
    });

    it('无映射字段时保留原样', () => {
      const result = mapFields({ name: 'x', deleted: false });
      expect(result).toEqual({ name: 'x', deleted: false });
    });
  });
});
