const express = require('express');
const http = require('http');
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ⭐ الحل النهائي: استخدام Chromium الموجود في النظام
const puppeteerConfig = {
    executablePath: '/usr/bin/chromium-browser', // ⭐ موجود على Render
    headless: 'new', // ⭐ استخدام headless الجديد
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
    ],
    ignoreHTTPSErrors: true
};

// التأكد من وجود المجلدات
const dataDir = path.join(__dirname, 'data');
const sessionsDir = path.join(dataDir, 'sessions');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

// ⭐ اختبار وجود المتصفح
console.log('🔍 التحقق من المتصفحات المتاحة...');
const possiblePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome'
];

let foundBrowser = null;
for (const browserPath of possiblePaths) {
    if (fs.existsSync(browserPath)) {
        foundBrowser = browserPath;
        console.log('✅ وجدت المتصفح:', browserPath);
        break;
    }
}

if (!foundBrowser) {
    console.log('❌ لم أجد أي متصفح، سيحاول Puppeteer استخدام المتصفح المدمج');
} else {
    puppeteerConfig.executablePath = foundBrowser;
}

// ⭐ هنا ضع كود مشروعك الكامل
// نظام الجلسات، الردود الذكية، إلخ...

// بدء البوت
function initializeBot() {
    console.log('🚀 بدء تشغيل البوت مع:', puppeteerConfig.executablePath || 'المتصفح الافتراضي');
    
    wppconnect.create({
        session: 'WhatsAppBusinessBot',
        puppeteerOptions: puppeteerConfig,
        catchQR: (base64Qr) => {
            console.log('📱 QR Code جاهز للربط!');
        },
        disableWelcome: true,
        updatesLog: false
    })
    .then((client) => {
        console.log('✅ البوت متصل بـ WhatsApp بنجاح!');
        
        client.onMessage(async (message) => {
            if (message.fromMe) return;
            
            // ⭐ كود الردود الذكية
            if (message.body === 'مرحبا') {
                await client.sendText(message.from, 'أهلاً بك! 🌟\nاختر الخدمة:\n1️⃣ أنظمة محاسبية\n2️⃣ خدمات تصميم');
            }
        });
    })
    .catch((error) => {
        console.error('❌ خطأ في البوت:', error.message);
        console.log('🔄 إعادة المحاولة بعد 15 ثانية...');
        setTimeout(initializeBot, 15000);
    });
}

// واجهة الويب
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Business Bot - التشغيل</title>
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; }
                .info { background: #e3f2fd; padding: 20px; border-radius: 10px; margin: 20px; }
            </style>
        </head>
        <body>
            <h1>🤖 WhatsApp Business Bot</h1>
            <div class="info">
                <h2>✅ النظام يعمل</h2>
                <p>المتصفح: ${puppeteerConfig.executablePath || 'سيستخدم الافتراضي'}</p>
                <p>الحالة: جاري التشغيل...</p>
            </div>
        </body>
        </html>
    `);
});

// بدء التشغيل
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 الخادم يعمل على: http://0.0.0.0:' + PORT);
    console.log('🔧 إعدادات المتصفح:', puppeteerConfig);
    
    setTimeout(initializeBot, 3000);
});
