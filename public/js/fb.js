// تشغيل Firebase بمكان واحد. نسخة الـ SDK مكتوبة هون بس، فلو بدنا نحدّثها بنغيّر سطر واحد.
// المتجر بيستعمل Firestore بس. تسجيل الدخول (Auth) بملف fb-auth.js للوحة التحكم بس،
// عشان صفحات المتجر ما تحمّل مكتبة الدخول ولا تستنى حساب الأدمن إذا كان داخل على نفس الجهاز.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// كل دوال Firestore (doc, getDoc, query, runTransaction ...)
export * from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const app = initializeApp(firebaseConfig);

let _db = null;

/**
 * قاعدة البيانات.
 * المتجر: db()  — عادي بدون تخزين محلي (النسخة السريعة من آخر زيارة محفوظة بـ localStorage، شوف common.js).
 * لوحة التحكم: db({ offline: true }) — بتحفظ نسخة على الجهاز، فبتفتح وبتعرض آخر بيانات حتى لو النت قاطع،
 * والتعديلات العادية بتتزامن لما يرجع. (العمليات اللي فيها transaction زي تأكيد الطلب بتحتاج نت.)
 * لازم تنادى أول مرة بالخيار الصح قبل أي استخدام ثاني.
 */
export function db(opts = {}) {
  if (_db) return _db;
  if (opts.offline) {
    try {
      _db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
    } catch (e) {
      console.warn("offline cache unavailable, using memory cache", e);
      _db = getFirestore(app);
    }
  } else {
    _db = getFirestore(app);
  }
  return _db;
}
