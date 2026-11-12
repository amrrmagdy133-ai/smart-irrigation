# نظام الري الذكي (ESP32 + Node.js)

## هيكل الملفات
```
smart-irrigation/
├── package.json
├── server.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── esp32_irrigation/
    └── esp32_irrigation.ino
```

## جدول التوصيل
| الحساس / القطعة | GPIO | ملاحظات |
|---|---|---|
| Soil (رطوبة التربة) | 34 | ADC1 - مدخل فقط، AO من الحساس |
| LDR (الإضاءة) | 35 | ADC1 - مقسم جهد: LDR + مقاومة 10K |
| TDS | 32 | ADC1 - الخرج التناظري (الجهد ≤ 3.3V) |
| DHT11 | 4 | بيانات رقمية + مقاومة 10K للـ 3.3V لو الموديول عاري |
| الطلمبة (ريلاي) | 26 | خرج رقمي (مسموح ADC2 هنا لأنه مش قراءة تناظرية) |

- كل الحساسات: VCC → 3.3V، GND → GND (مشترك مع ESP32).
- الطلمبة ماتتوصلش مباشرة بالـ ESP32: استخدم ريلاي (IN → GPIO 26) واجعل الطلمبة على مصدرها الخاص.
- لو الريلاي بيشتغل بـ LOW غيّر `PUMP_ACTIVE_LOW` إلى `true`.

## تشغيل السيرفر على Replit
1. ادخل replit.com وسجل دخول، واضغط **Create Repl**، واختار قالب **Node.js**.
2. ارفع الملفات (`package.json`, `server.js`, ومجلد `public`) بنفس الهيكل (Upload file/folder من قائمة الملفات).
3. افتح **Shell** واكتب: `npm install`
4. (اختياري للتجربة من غير ESP32) من **Secrets** (Tools ← Secrets) أضف: `MOCK` = `true`
5. اضغط **Run**. هتظهر الواجهة في نافذة Webview.
6. للاستخدام المستمر (24 ساعة) اعمل **Deploy** (Publish) بنوع Autoscale أو Reserved VM، لأن الـ Repl العادي بينام لما تقفل الصفحة. لو عملت Deploy أضف `MOCK` في Secrets الخاصة بالـ Deployment كمان.

## إزاي تجيب SERVER_URL
- الرابط هو اللي بيظهر فوق نافذة **Webview** (مثال: `https://smart-irrigation.yourname.replit.app`)، أو رابط الـ Deployment بعد النشر.
- انسخه، وحطه في كود ESP32 **من غير** `/` في الآخر:
```cpp
const char* SERVER_URL = "https://smart-irrigation.yourname.replit.app";
```
- جرّب الرابط في المتصفح + `/api/data` للتأكد إن السيرفر شغال.

## تشغيل كود ESP32
1. ثبّت **Arduino IDE** ثم من Boards Manager ثبّت **esp32 by Espressif**.
2. من Library Manager ثبّت: **ArduinoJson (7.x)** و **DHT sensor library** (Adafruit) و **Adafruit Unified Sensor**.
3. افتح `esp32_irrigation.ino` وعدّل `WIFI_SSID` و`WIFI_PASS` و`SERVER_URL`.
4. اختار Board: **ESP32 Dev Module** والـ Port، واضغط Upload.
5. افتح **Serial Monitor** على سرعة **115200** لمتابعة القراءات.

## ملاحظات
- المنطق الأوتوماتيك: لو `soil < threshold` الطلمبة تشتغل. بعض حساسات التربة بتدي قيمة **أعلى** كلما كانت التربة أجف، فلو حسابك كده، عايرها (اقرأ قيمة جافة ومبللة) وعدّل الشرط في `server.js` (دالة `pumpState`).
- بيانات التخزين in-memory: بتتمسح مع إعادة تشغيل السيرفر.
- `setInsecure()` للتجربة فقط؛ للإنتاج استخدم شهادة الجذر.
