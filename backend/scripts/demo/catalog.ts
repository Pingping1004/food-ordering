/**
 * Fixed content for the demo school: shops, menus, staff and the words students write.
 * Edit freely – seed.ts and live.ts read everything from here. Prices are in baht, times in minutes.
 */
import { RestaurantCategory } from '@prisma/client';

export const DEMO_SCHOOL = {
  name: 'โรงเรียนสาธิต PromptServe (ข้อมูลสาธิต)',
  email: 'demo-school@promptserve.online',
  studentAmount: 1200,
  /** Students who have an account by the end of the seeded period (adoption grows week by week). */
  signedUpStudents: 640,
};

/** Login accounts created in Supabase with `--with-logins` (password = DEMO_PASSWORD). */
export const DEMO_LOGINS = {
  student: { email: 'demo.student@promptserve.online', name: 'มายด์ (นักเรียนสาธิต)' },
  cook: { email: 'demo.cook@promptserve.online', name: 'ป้าแดง (ร้านสาธิต)' },
  schoolAdmin: { email: 'demo.school@promptserve.online', name: 'ครูสมใจ (ผู้ดูแลสาธิต)' },
};

export type MenuSeed = { name: string; price: number; cook: number; maxDaily: number; weight: number };

export type ShopSeed = {
  key: string;
  name: string;
  canteen: 'main' | 'junior';
  categories: RestaurantCategory[];
  /** Share of the canteen's orders this shop gets. */
  popularity: number;
  maxActiveOrders: number;
  avgCookingTimeMins: number;
  autoAccept: boolean;
  /** Minutes after midnight, Mon–Fri. */
  open: number;
  close: number;
  /** 1 = typical. Bigger = slower to press "accept". */
  acceptSlowness: number;
  /** Mean star rating students give this shop when nothing went wrong. */
  ratingBase: number;
  /** Share of orders this shop marks as delayed. */
  delayRate: number;
  owner: string;
  staff: string[];
  location: string;
  /** Good for the 09:30 break (drinks, snacks). */
  morning: boolean;
  menus: MenuSeed[];
  status?: 'ACTIVE' | 'PENDING' | 'INACTIVE';
};

export const CANTEENS = {
  main: { name: 'โรงอาหารกลาง', open: 7 * 60, close: 15 * 60 + 30 },
  junior: { name: 'โรงอาหาร ม.ต้น', open: 10 * 60, close: 13 * 60 + 30 },
} as const;

export const SHOPS: ShopSeed[] = [
  {
    key: 'tamsang', name: 'ร้านตามสั่งป้าแดง', canteen: 'main', categories: ['Made_to_order', 'Rice'],
    popularity: 0.27, maxActiveOrders: 12, avgCookingTimeMins: 6, autoAccept: false, open: 630, close: 840,
    acceptSlowness: 1.0, ratingBase: 4.5, delayRate: 0.035, owner: 'ป้าแดง', staff: ['น้องนุ่น'], location: 'ล็อก 5', morning: false,
    menus: [
      { name: 'ข้าวกะเพราไก่ ไข่ดาว', price: 50, cook: 6, maxDaily: 60, weight: 10 },
      { name: 'ข้าวกะเพราหมูสับ', price: 45, cook: 6, maxDaily: 50, weight: 7 },
      { name: 'ข้าวผัดหมู', price: 35, cook: 5, maxDaily: 50, weight: 6 },
      { name: 'ข้าวผัดกุ้ง', price: 55, cook: 6, maxDaily: 30, weight: 3 },
      { name: 'ไข่เจียวหมูสับราดข้าว', price: 40, cook: 4, maxDaily: 40, weight: 5 },
      { name: 'ราดหน้าหมู', price: 45, cook: 7, maxDaily: 30, weight: 3 },
      { name: 'ผัดซีอิ๊วหมู', price: 45, cook: 6, maxDaily: 30, weight: 3 },
      { name: 'ข้าวไข่ข้นปู', price: 50, cook: 6, maxDaily: 25, weight: 2 },
      { name: 'ข้าวหมูกระเทียม', price: 45, cook: 5, maxDaily: 30, weight: 3 },
    ],
  },
  {
    key: 'noodle', name: 'ก๋วยเตี๋ยวเรือลุงชัย', canteen: 'main', categories: ['Noodle'],
    popularity: 0.21, maxActiveOrders: 14, avgCookingTimeMins: 4, autoAccept: false, open: 630, close: 840,
    acceptSlowness: 1.25, ratingBase: 4.0, delayRate: 0.05, owner: 'ลุงชัย', staff: ['น้าเล็ก'], location: 'ล็อก 3', morning: false,
    menus: [
      { name: 'ก๋วยเตี๋ยวเรือหมู เส้นเล็ก', price: 40, cook: 4, maxDaily: 70, weight: 8 },
      { name: 'ก๋วยเตี๋ยวเรือเนื้อ เส้นหมี่', price: 50, cook: 4, maxDaily: 40, weight: 4 },
      { name: 'เส้นเล็กต้มยำ', price: 45, cook: 5, maxDaily: 50, weight: 6 },
      { name: 'บะหมี่แห้งหมูแดง', price: 45, cook: 4, maxDaily: 40, weight: 4 },
      { name: 'เกาเหลาลูกชิ้น', price: 40, cook: 4, maxDaily: 30, weight: 2 },
      { name: 'เย็นตาโฟ', price: 45, cook: 5, maxDaily: 30, weight: 3 },
    ],
  },
  {
    key: 'chicken', name: 'ข้าวมันไก่ฮาลาลบังหมัด', canteen: 'main', categories: ['Halal', 'Rice'],
    popularity: 0.17, maxActiveOrders: 10, avgCookingTimeMins: 2, autoAccept: false, open: 630, close: 810,
    acceptSlowness: 0.8, ratingBase: 4.4, delayRate: 0.02, owner: 'บังหมัด', staff: [], location: 'ล็อก 7', morning: false,
    menus: [
      { name: 'ข้าวมันไก่ต้ม', price: 45, cook: 2, maxDaily: 60, weight: 8 },
      { name: 'ข้าวมันไก่ทอด', price: 45, cook: 2, maxDaily: 50, weight: 6 },
      { name: 'ข้าวมันไก่ผสม', price: 55, cook: 2, maxDaily: 40, weight: 4 },
      { name: 'ข้าวหมกไก่', price: 55, cook: 2, maxDaily: 30, weight: 3 },
      { name: 'ซุปไก่', price: 20, cook: 1, maxDaily: 30, weight: 1 },
    ],
  },
  {
    key: 'esan', name: 'ส้มตำไก่ย่างแม่น้อย', canteen: 'main', categories: ['Esan'],
    popularity: 0.13, maxActiveOrders: 8, avgCookingTimeMins: 7, autoAccept: false, open: 630, close: 840,
    acceptSlowness: 1.5, ratingBase: 4.2, delayRate: 0.06, owner: 'แม่น้อย', staff: [], location: 'ล็อก 8', morning: false,
    menus: [
      { name: 'ส้มตำไทย', price: 40, cook: 5, maxDaily: 40, weight: 6 },
      { name: 'ส้มตำปูปลาร้า', price: 40, cook: 5, maxDaily: 30, weight: 4 },
      { name: 'ไก่ย่าง + ข้าวเหนียว', price: 50, cook: 3, maxDaily: 40, weight: 6 },
      { name: 'คอหมูย่าง + ข้าวเหนียว', price: 55, cook: 4, maxDaily: 30, weight: 4 },
      { name: 'ลาบหมู + ข้าวเหนียว', price: 50, cook: 6, maxDaily: 25, weight: 3 },
      { name: 'ข้าวเหนียว', price: 10, cook: 1, maxDaily: 80, weight: 2 },
    ],
  },
  {
    key: 'drinks', name: 'มุมเครื่องดื่มน้องฟ้า', canteen: 'main', categories: ['Appetizer'],
    popularity: 0.16, maxActiveOrders: 20, avgCookingTimeMins: 2, autoAccept: true, open: 450, close: 900,
    acceptSlowness: 0, ratingBase: 4.7, delayRate: 0.01, owner: 'น้องฟ้า', staff: ['น้องมิว'], location: 'ล็อก 1', morning: true,
    menus: [
      { name: 'ชาเย็น', price: 25, cook: 2, maxDaily: 100, weight: 9 },
      { name: 'ชาเขียวนม', price: 30, cook: 2, maxDaily: 80, weight: 6 },
      { name: 'โกโก้เย็น', price: 30, cook: 2, maxDaily: 80, weight: 5 },
      { name: 'นมชมพู', price: 25, cook: 2, maxDaily: 60, weight: 4 },
      { name: 'น้ำมะนาวโซดา', price: 30, cook: 2, maxDaily: 50, weight: 3 },
      { name: 'น้ำเปล่า', price: 10, cook: 1, maxDaily: 150, weight: 4 },
      { name: 'ขนมปังปิ้งนมข้น', price: 20, cook: 3, maxDaily: 50, weight: 4 },
    ],
  },
  {
    key: 'curry', name: 'ข้าวแกงป้าศรี', canteen: 'junior', categories: ['Rice'],
    popularity: 0.6, maxActiveOrders: 10, avgCookingTimeMins: 2, autoAccept: false, open: 630, close: 780,
    acceptSlowness: 1.1, ratingBase: 4.3, delayRate: 0.02, owner: 'ป้าศรี', staff: [], location: 'ล็อก 2', morning: false,
    menus: [
      { name: 'ข้าวแกงเขียวหวานไก่', price: 40, cook: 2, maxDaily: 40, weight: 5 },
      { name: 'ข้าวพะแนงหมู', price: 40, cook: 2, maxDaily: 35, weight: 4 },
      { name: 'ข้าวผัดพริกแกงหมู', price: 40, cook: 2, maxDaily: 30, weight: 3 },
      { name: 'ข้าว 2 อย่าง', price: 45, cook: 2, maxDaily: 50, weight: 6 },
    ],
  },
  {
    key: 'dessert', name: 'ขนมหวานบ้านฝ้าย', canteen: 'junior', categories: ['Appetizer'],
    popularity: 0.4, maxActiveOrders: 12, avgCookingTimeMins: 2, autoAccept: false, open: 600, close: 810,
    acceptSlowness: 0.9, ratingBase: 4.6, delayRate: 0.01, owner: 'พี่ฝ้าย', staff: [], location: 'ล็อก 4', morning: true,
    menus: [
      { name: 'บัวลอยไข่หวาน', price: 25, cook: 2, maxDaily: 30, weight: 4 },
      { name: 'ลอดช่องน้ำกะทิ', price: 20, cook: 2, maxDaily: 40, weight: 4 },
      { name: 'ทับทิมกรอบ', price: 25, cook: 2, maxDaily: 40, weight: 5 },
      { name: 'กล้วยบวชชี', price: 20, cook: 2, maxDaily: 25, weight: 2 },
    ],
  },
  {
    key: 'steak', name: 'สเต๊กลูกชาย', canteen: 'main', categories: ['Steak'], status: 'PENDING',
    popularity: 0, maxActiveOrders: 8, avgCookingTimeMins: 8, autoAccept: false, open: 630, close: 840,
    acceptSlowness: 1, ratingBase: 4.3, delayRate: 0.03, owner: 'ลูกชาย', staff: [], location: 'ล็อก 9', morning: false,
    menus: [
      { name: 'สเต๊กหมู', price: 69, cook: 8, maxDaily: 30, weight: 5 },
      { name: 'สเต๊กไก่', price: 59, cook: 8, maxDaily: 30, weight: 5 },
    ],
  },
];

/** Other school admins (the last one waits on the approvals page). */
export const SCHOOL_ADMINS = [
  { name: 'ครูวิชัย', status: 'APPROVED' as const },
  { name: 'ผอ.ประเสริฐ', status: 'APPROVED' as const },
  { name: 'ครูอรุณี', status: 'PENDING' as const },
];

export const NICKNAMES = [
  'มายด์', 'ฟ้า', 'ต้นข้าว', 'ปลื้ม', 'ภูมิ', 'แพรว', 'ไอซ์', 'บีม', 'นัท', 'มิ้นท์', 'เจมส์', 'ใบเตย', 'ปาล์ม', 'ออม', 'กาย',
  'แบม', 'ข้าวหอม', 'ตะวัน', 'น้ำฝน', 'พลอย', 'ภู', 'เฟิร์น', 'อิง', 'ฟลุ๊ค', 'ปั้น', 'ใบบัว', 'ซัน', 'นิว', 'เอิร์ธ', 'ข้าวปุ้น',
  'วิว', 'ณัฐ', 'ต้นกล้า', 'มะปราง', 'ก้อง', 'ปิ่น', 'เพชร', 'จูน', 'ไผ่', 'แป้ง', 'กันต์', 'ปุยฝ้าย', 'ธันวา', 'มีน', 'โอ๊ต',
];

/** Comments students leave with a rating. Grouped by how the meal went. */
export const COMMENTS = {
  good: [
    'อร่อยมาก ได้ตรงเวลาเป๊ะ', 'ไม่ต้องต่อคิวแล้ว สะดวกมากครับ', 'สั่งตอนพักเบรกเช้า เที่ยงมารับเลย ชอบ', 'ป้าทำไวมาก ขอบคุณค่ะ',
    'ได้กินเร็วขึ้น มีเวลาไปห้องสมุด', 'ใช้ง่าย สั่งไม่ถึงนาที', 'ชาเย็นหวานกำลังดี', 'ได้ตามที่สั่งทุกอย่าง',
    'วันนี้คนเยอะแต่ได้อาหารตรงเวลา', 'ดีกว่ายืนรอหน้าร้านเยอะเลย',
  ],
  ok: [
    'อร่อยแต่รอนานกว่าที่แจ้งนิดหน่อย', 'อยากให้มีเมนูมากกว่านี้', 'บางวันเมนูหมดเร็ว', 'อยากให้แจ้งเตือนดังกว่านี้',
    'โอเคครับ แต่ช่วง 12:00 คนเยอะ', 'อยากให้จ่ายเงินสดได้ด้วย',
  ],
  bad: [
    'รออาหารนานกว่าเวลาที่เลือก 10 นาที', 'ได้ไม่ครบ ขาดไข่ดาว', 'ร้านไม่กดรับ ต้องสั่งใหม่', 'อาหารเย็นแล้วตอนไปรับ',
  ],
};

export const COMPLAINTS = [
  { target: 'SCHOOL' as const, message: 'ไปรับแล้วร้านบอกว่ายังไม่ได้ทำ ต้องรอเพิ่ม 15 นาที', resolved: false, shop: 'noodle' },
  { target: 'SCHOOL' as const, message: 'ได้อาหารไม่ครบ สั่ง 2 จานได้จานเดียว', resolved: true, shop: 'tamsang' },
  { target: 'SCHOOL' as const, message: 'จ่ายเงินแล้วแต่ร้านกดยกเลิก ยังไม่ได้เงินคืน', resolved: false, shop: 'esan' },
  { target: 'SCHOOL' as const, message: 'ช่วงพักเที่ยงโต๊ะหน้าร้านแน่นมาก จุดรับอาหารไม่ชัด', resolved: true, shop: 'tamsang' },
  { target: 'SYSTEM' as const, message: 'อัปโหลดสลิปแล้วขึ้นว่าไม่ผ่าน ทั้งที่โอนถูกยอด', resolved: true, shop: 'chicken' },
  { target: 'SYSTEM' as const, message: 'ไม่มีแจ้งเตือนตอนอาหารเสร็จ (iPhone)', resolved: false, shop: 'drinks' },
];
