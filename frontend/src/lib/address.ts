import type { AddressInput, AddressSnapshot } from '../api/types';

/** Hong Kong regions for the 地區 field (reusable by the address book, #44). */
export const HK_REGIONS = ['香港島', '九龍', '新界', '離島'] as const;

export const MAX_ADDRESSES = 20;

export type AddressErrors = Partial<Record<keyof AddressInput, string>>;

/** HK phone: 8 digits starting 2–9, optional +852 / spaces / hyphen. */
export const normalisePhone = (s: string) => {
  const compact = s.replace(/[\s-]/g, '');
  return /^(?:\+852|852)[2-9]\d{7}$/.test(compact) ? compact.replace(/^\+?852/, '') : compact;
};
export const isHkPhone = (s: string) => /^[2-9]\d{7}$/.test(normalisePhone(s));

/** Shared by the checkout form and the mock server; empty object = valid. */
export function validateAddress(a: Partial<AddressInput>): AddressErrors {
  const e: AddressErrors = {};
  const recipient = a.recipient?.trim() ?? '';
  if (!recipient) e.recipient = '請輸入收件人';
  else if (recipient.length > 50) e.recipient = '收件人最多 50 字';
  if (!a.phone?.trim()) e.phone = '請輸入電話';
  else if (!isHkPhone(a.phone)) e.phone = '請輸入 8 位香港電話號碼';
  if (!a.region) e.region = '請選擇地區';
  else if (!(HK_REGIONS as readonly string[]).includes(a.region)) e.region = '地區無效';
  const line1 = a.line1?.trim() ?? '';
  if (!line1) e.line1 = '請輸入詳細地址';
  else if (line1.length < 5) e.line1 = '詳細地址最少 5 字';
  else if (line1.length > 200) e.line1 = '詳細地址最多 200 字';
  return e;
}

/** "香港島 中環皇后大道中 1 號" */
export const formatAddress = (a: Pick<AddressSnapshot, 'region' | 'line1'>) => `${a.region} ${a.line1}`;
