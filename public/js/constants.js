// قيم ثابتة مشتركة: حالات الطلب، طرق الدفع، وقوالب الرسائل الافتراضية

// حالات الطلب بالترتيب. "قيد التحضير" مش حالة بتنكبس، بتنحسب بالعرض لما يقرب موعد التوصيل
export const ORDER_STATUS = {
  new:       { label: "جديد",          step: 0 },
  confirmed: { label: "مؤكد",          step: 1 },
  out:       { label: "طلع للتوصيل",   step: 2 },
  delivered: { label: "وصل",           step: 3 },
  cancelled: { label: "ملغي",          step: -1 },
};

export const PAY_METHODS = {
  cash:     { label: "كاش عند الاستلام", hint: "بتدفع للمندوب لما يوصلك الطلب" },
  transfer: { label: "تحويل بنكي",       hint: "بنبعتلك بيانات الحساب عالواتساب بعد ما نأكد الطلب" },
};

// شو بيصير لما المنتج يخلص
export const WHEN_OUT = {
  soldout:  "بيبين خلص",
  preorder: "بيتحول طلب مسبق",
};

// الوحدة اللي بينحسب فيها المخزون لكل منتج
export const STOCK_UNITS = {
  kg:    "كيلو",
  piece: "حبة",
  jar:   "مرطبان",
  tray:  "سدر",
};

// قوالب رسائل الواتساب الافتراضية. المتغيرات بين { } بتتعبّى لحالها
export const DEFAULT_WA_TEMPLATES = {
  confirmed: "أهلاً {الاسم}، تأكد طلبك {رقم_الطلب} من خضرة براند.\nموعد التوصيل: {الموعد}\nالمجموع: {المجموع}\nتقدر تتابع طلبك من هون: {رابط_التتبع}",
  out: "أهلاً {الاسم}، طلبك {رقم_الطلب} طلع للتوصيل وبيوصلك قريب.",
  delivered: "وصل طلبك {رقم_الطلب}، صحتين وعافية. ورأيك بيهمنا.",
  cancelled: "أهلاً {الاسم}، للأسف انلغى طلبك {رقم_الطلب}. {السبب}",
  transfer: "بيانات التحويل البنكي لطلب {رقم_الطلب}:\n{تفاصيل_التحويل}\nالمبلغ: {المجموع}\nبعد التحويل ابعتلنا صورة الإشعار هون.",
};

export const ORDER_PREFIX = "KH-";

// الإعدادات الأولى للمتجر. لوحة التحكم بتعملها لحالها إذا مش موجودة
export const DEFAULT_SETTINGS = {
  storeOpen: true,
  closedMessage: "المتجر مسكّر هالفترة، ارجعولنا قريب.",
  whatsapp: "",
  countryCode: "970",
  freeDeliveryMin: 0,
  payMethods: { cash: true, transfer: true },
  transferInfo: "",
  timeSlots: ["الصبح", "العصر"],
  waTemplates: DEFAULT_WA_TEMPLATES,
  announcement: { text: "", active: false },
};

// نصوص المشاهد الخمسة بالرئيسية
export const DEFAULT_STORY = {
  scenes: [
    { key: "olive", tag: "الشجرة", line: "كل مرطبان\nبلّش بشجرة", video: "", poster: "" },
    { key: "honey", tag: "العسل", line: "من أرض غزة،\nعلى مهلها", video: "", poster: "" },
    { key: "hands", tag: "الإيدين", line: "بإيدين\nبتعرف الطعمة", video: "", poster: "" },
    { key: "jar", tag: "الدفعة", line: "بيتعبّى طازة،\nدفعة بدفعة", video: "", poster: "" },
    { key: "sofra", tag: "السفرة", line: "وبتوصل\nلسفرتك", video: "", poster: "" },
  ],
};
