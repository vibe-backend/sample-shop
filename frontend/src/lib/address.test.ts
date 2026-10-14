import { describe, expect, it } from 'vitest';
import { formatAddress, isHkPhone, validateAddress } from './address';

describe('address validation', () => {
  it('accepts a complete HK address', () => {
    expect(validateAddress({ recipient: '陳小明', phone: '9123 4567', region: '九龍', line1: '旺角彌敦道 688 號' })).toEqual({});
  });
  it('flags every required field', () => {
    expect(Object.keys(validateAddress({}))).toEqual(['recipient', 'phone', 'region', 'line1']);
  });
  it('checks HK phone format', () => {
    expect(isHkPhone('+852 6123-4567')).toBe(true);
    expect(isHkPhone('85212345')).toBe(true);
    expect(isHkPhone('852 6123-4567')).toBe(true);
    expect(isHkPhone('+85212345')).toBe(false);
    expect(isHkPhone('12345678')).toBe(false);
    expect(isHkPhone('9123456')).toBe(false);
    expect(validateAddress({ recipient: 'a', phone: '1234', region: '九龍', line1: '12345' }).phone).toBe('請輸入 8 位香港電話號碼');
  });
  it('formats region + detail', () => {
    expect(formatAddress({ region: '新界', line1: '沙田正街 1 號' })).toBe('新界 沙田正街 1 號');
  });
});
