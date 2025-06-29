export interface KeyValueType  {
  label: string;
  value: string;
}

export const buttonLabels: KeyValueType[] = [
  { label: 'อาหารอีสาน', value: 'Esan' },
  { label: 'สเต็ก', value: 'Steak' },
  { label: 'เมนูข้าว', value: 'Rice' },
  { label: 'ฮาลาล', value: 'Halal' },
  { label: 'ของหวาน', value: 'Dessert' },
  { label: 'ตามสั่ง', value: 'Made_to_order' },
  { label: 'ก๋วยเตี๋ยว', value: 'Noodle' },
  { label: 'อาหารทานเล่น', value: 'Appetizer' },
];

export const shortEngDays = [
  { label: 'Sun', value: 'sun' },
  { label: 'Mon', value: 'mon' },
  { label: 'Tue', value: 'tue' },
  { label: 'Wed', value: 'wed' },
  { label: 'Thu', value: 'thu' },
  { label: 'Fri', value: 'fri' },
  { label: 'Sat', value: 'sat' },
];