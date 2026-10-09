// تسجيل الدخول: للوحة التحكم وأداة seed بس. صفحات المتجر ما بتستورد هالملف.
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from "./fb.js";

export * from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
export const auth = getAuth(app);
