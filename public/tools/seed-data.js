// بيانات البداية. المنتجات والمناطق تجريبية (demo: true) وبتنمسح بكبسة من صفحة seed.html
// الأسعار هون أمثلة للتجربة بس، لازم تتبدّل بأسعار خضرة الحقيقية
import { DEFAULT_SETTINGS, DEFAULT_STORY } from "../js/constants.js";

export const SETTINGS = DEFAULT_SETTINGS;
export const STORY = DEFAULT_STORY;

export const CATEGORIES = [
  { id: "pickles", name: "مخللات", slug: "مخللات", image: "assets/demo/peppers.jpg", order: 1, visible: true },
  { id: "honey", name: "عسل", slug: "عسل", image: "assets/demo/honey.jpg", order: 2, visible: true },
  { id: "nuts", name: "مكسرات وبذور", slug: "مكسرات-وبذور", image: "assets/demo/nuts.jpg", order: 3, visible: true },
  { id: "dates", name: "تمور", slug: "تمور", image: "assets/demo/dates.jpg", order: 4, visible: true },
  { id: "sweets", name: "حلويات", slug: "حلويات", image: "assets/demo/balls.jpg", order: 5, visible: true },
];

export const AREAS = [
  { id: "demo-area-1", name: "منطقة تجريبية ١", fee: 10, active: true, order: 1, demo: true },
  { id: "demo-area-2", name: "منطقة تجريبية ٢", fee: 15, active: true, order: 2, demo: true },
];

// sizes[].use = قديش بياكل الحجم من وحدة المخزون (unit)
export const PRODUCTS = [
  {
    id: "demo-peppers", name: "مخلل فلفل مشكّل", categoryId: "pickles",
    description: "فلفل أحمر وأصفر، مخلل على الطريقة البيتية.",
    images: ["assets/demo/peppers.jpg"], video: "",
    unit: "kg", stock: 20, lowAlert: 4, whenOut: "preorder", prepDays: 5, madeToOrder: false,
    sizes: [
      { id: "500", label: "٥٠٠ غ", price: 10, use: 0.5 },
      { id: "1000", label: "١ كغ", price: 18, use: 1 },
      { id: "2000", label: "٢ كغ", price: 34, use: 2 },
    ],
    pairsWith: ["الفلافل", "المجدرة", "المقلوبة"], ingredients: "", storage: "بعد الفتح بيتحفظ بالثلاجة، وخلّي الفلفل مغطى بالمحلول.",
    featured: true, order: 1, occasions: ["فطور العيلة"],
  },
  {
    id: "demo-lemons", name: "مخلل ليمون", categoryId: "pickles",
    description: "ليمون بلدي مخلل.", images: ["assets/demo/lemons.jpg"], video: "",
    unit: "kg", stock: 6, lowAlert: 3, whenOut: "soldout", prepDays: 0, madeToOrder: false,
    sizes: [
      { id: "500", label: "٥٠٠ غ", price: 8, use: 0.5 },
      { id: "1000", label: "١ كغ", price: 15, use: 1 },
    ],
    pairsWith: ["الغدا"], ingredients: "", storage: "", featured: false, order: 2, occasions: [],
  },
  {
    id: "demo-greens", name: "فلفل أخضر مخلل", categoryId: "pickles",
    description: "فلفل أخضر حار مخلل.", images: ["assets/demo/greens.jpg"], video: "",
    unit: "kg", stock: 8, lowAlert: 3, whenOut: "soldout", prepDays: 0, madeToOrder: false,
    sizes: [
      { id: "500", label: "٥٠٠ غ", price: 9, use: 0.5 },
      { id: "1000", label: "١ كغ", price: 16, use: 1 },
    ],
    pairsWith: ["الفلافل"], ingredients: "", storage: "", featured: false, order: 3, occasions: [],
  },
  {
    id: "demo-honey", name: "عسل طبيعي", categoryId: "honey",
    description: "عسل طبيعي.", images: ["assets/demo/honey.jpg"], video: "",
    unit: "kg", stock: 5, lowAlert: 1, whenOut: "soldout", prepDays: 0, madeToOrder: false,
    sizes: [
      { id: "250", label: "ربع كيلو", price: 20, use: 0.25 },
      { id: "500", label: "نص كيلو", price: 38, use: 0.5 },
    ],
    pairsWith: ["الفطور"], ingredients: "", storage: "", featured: true, order: 1, occasions: ["هدية زيارة"],
  },
  {
    id: "demo-nuts", name: "مكسرات مشكّلة", categoryId: "nuts",
    description: "تشكيلة مكسرات.", images: ["assets/demo/nuts.jpg"], video: "",
    unit: "kg", stock: 10, lowAlert: 2, whenOut: "soldout", prepDays: 0, madeToOrder: false,
    sizes: [
      { id: "250", label: "٢٥٠ غ", price: 15, use: 0.25 },
      { id: "500", label: "٥٠٠ غ", price: 28, use: 0.5 },
      { id: "1000", label: "١ كغ", price: 54, use: 1 },
    ],
    pairsWith: ["الضيافة"], ingredients: "", storage: "", featured: true, order: 1, occasions: ["ضيافة عزومة"],
  },
  {
    id: "demo-mix", name: "تسالي مشكّلة", categoryId: "nuts",
    description: "بذور وتسالي ملوّنة.", images: ["assets/demo/mix.jpg"], video: "",
    unit: "kg", stock: 10, lowAlert: 2, whenOut: "soldout", prepDays: 0, madeToOrder: false,
    sizes: [
      { id: "250", label: "٢٥٠ غ", price: 8, use: 0.25 },
      { id: "500", label: "٥٠٠ غ", price: 15, use: 0.5 },
    ],
    pairsWith: [], ingredients: "", storage: "", featured: false, order: 2, occasions: ["ضيافة عزومة"],
  },
  {
    id: "demo-dates", name: "تمر", categoryId: "dates",
    description: "تمر.", images: ["assets/demo/dates.jpg"], video: "",
    unit: "kg", stock: 12, lowAlert: 2, whenOut: "soldout", prepDays: 0, madeToOrder: false,
    sizes: [
      { id: "500", label: "٥٠٠ غ", price: 12, use: 0.5 },
      { id: "1000", label: "١ كغ", price: 22, use: 1 },
    ],
    pairsWith: ["القهوة"], ingredients: "", storage: "", featured: false, order: 1, occasions: ["رمضان"],
  },
  {
    id: "demo-balls", name: "كرات التمر بالسمسم", categoryId: "sweets",
    description: "كرات تمر ملفوفة بالسمسم وجوز الهند.", images: ["assets/demo/balls.jpg"], video: "",
    unit: "piece", stock: 0, lowAlert: 0, whenOut: "preorder", prepDays: 3, madeToOrder: true,
    sizes: [
      { id: "12", label: "سدر ١٢ حبة", price: 25, use: 12 },
      { id: "24", label: "سدر ٢٤ حبة", price: 45, use: 24 },
    ],
    pairsWith: ["القهوة"], ingredients: "", storage: "", featured: true, order: 1, occasions: ["ضيافة عزومة", "رمضان"],
  },
  {
    id: "demo-apricot", name: "مشمشية بالجوز", categoryId: "sweets",
    description: "قمر الدين محشي جوز.", images: ["assets/demo/apricot.jpg"], video: "",
    unit: "piece", stock: 0, lowAlert: 0, whenOut: "preorder", prepDays: 3, madeToOrder: true,
    sizes: [
      { id: "12", label: "١٢ حبة", price: 30, use: 12 },
      { id: "24", label: "٢٤ حبة", price: 55, use: 24 },
    ],
    pairsWith: ["القهوة"], ingredients: "", storage: "", featured: false, order: 2, occasions: ["هدية زيارة"],
  },
];

// قالب "ركّب علبتك": الزبون بيختار 4 أصناف من المسموحة، والسعر = مجموعهم
export const BOXES = [
  {
    id: "demo-box-4", name: "علبة ٤ أصناف", description: "اختار ٤ أصناف على ذوقك.",
    image: "assets/demo/mix.jpg", slots: 4, pricing: "sum", fixedPrice: 0,
    allowed: [
      { productId: "demo-nuts", sizeId: "250" },
      { productId: "demo-mix", sizeId: "250" },
      { productId: "demo-dates", sizeId: "500" },
      { productId: "demo-balls", sizeId: "12" },
      { productId: "demo-apricot", sizeId: "12" },
    ],
    visible: true, order: 1,
  },
];
