const express = require('express');
const http = require('http');
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ⭐ الحل النهائي: لا تستخدم executablePath - دع Puppeteer يتعامل معه
const puppeteerConfig = {
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--remote-debugging-port=9222'
    ],
    ignoreHTTPSErrors: true
};

console.log('🚀 إعدادات Puppeteer:', puppeteerConfig);

// ⭐ أضف postinstall في package.json لتثبيت المتصفح
const packageJson = {
    "name": "whatsapp-business-bot",
    "version": "1.0.0",
    "dependencies": {
        "@wppconnect-team/wppconnect": "^1.24.0",
        "express": "^4.18.0",
        "puppeteer": "^21.0.0"
    },
    "scripts": {
        "start": "node index.js",
        "postinstall": "npx puppeteer browsers install chrome"
    }
};

// التأكد من وجود المجلدات
const dataDir = path.join(__dirname, 'data');
const sessionsDir = path.join(dataDir, 'sessions');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

// بدء البوت
function initializeBot() {
    console.log('🚀 بدء تشغيل البوت بدون تحديد مسار المتصفح...');
    console.log('📝 Puppeteer سيجد المتصفح المدمج تلقائياً');
    
    wppconnect.create({
        session: 'WhatsAppBusinessBot',
        puppeteerOptions: puppeteerConfig, // ⭐ بدون executablePath
        catchQR: (base64Qr) => {
            console.log('📱 QR Code جاهز للربط!');
            console.log('🔗 امسح الكود من تطبيق WhatsApp');
        },
        disableWelcome: true,
        updatesLog: false,
        logQR: true
    })
    .then((client) => {
        console.log('✅ البوت متصل بـ WhatsApp بنجاح!');
        
        client.onMessage(async (message) => {
            if (message.fromMe) return;
            
            console.log('📩 رسالة جديدة من:', message.from, '- المحتوى:', message.body);
            
            // ⭐ كود الردود البسيط
            if (message.body.toLowerCase().includes('مرحبا') || message.body.toLowerCase().includes('اهلا')) {
                await client.sendText(message.from, 
                    'أهلاً بك! 🌟\n\n' +
                    'اختر الخدمة:\n' +
                    '1️⃣ أنظمة محاسبية\n' +
                    '2️⃣ خدمات تصميم\n' +
                    '3️⃣ التواصل مع المبيعات\n\n' +
                    '📝 أرسل رقم الخدمة'
                );
            }
        });
    })
    .catch((error) => {
        console.error('❌ خطأ في البوت:', error.message);
        
        if (error.message.includes('browser') || error.message.includes('chrome')) {
            console.log('💡 الحل: تأكد من إضافة postinstall في package.json');
        }
        
        console.log('🔄 إعادة المحاولة بعد 20 ثانية...');
        setTimeout(initializeBot, 20000);
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
                body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                .success { background: #d4edda; color: #155724; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .info { background: #e3f2fd; padding: 15px; border-radius: 10px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 WhatsApp Business Bot</h1>
                <div class="success">
                    <h2>✅ الخادم يعمل بنجاح</h2>
                    <p>جاري تشغيل البوت الكامل...</p>
                </div>
                <div class="info">
                    <h3>📊 معلومات النظام</h3>
                    <p><strong>الحالة:</strong> 🔄 جاري الاتصال بـ WhatsApp</p>
                    <p><strong>المتصفح:</strong> سيستخدم Puppeteer المتصفح المدمج</p>
                    <p><strong>الرابط:</strong> https://whatsapp-business-bot-90cr.onrender.com</p>
                </div>
                <p>⏳ قد يستغرق الاتصال الأولي بضع دقائق...</p>
            </div>
        </body>
        </html>
    `);
});

// بدء التشغيل
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 الخادم يعمل على: http://0.0.0.0:' + PORT);
    console.log('🌐 الرابط العام: https://whatsapp-business-bot-90cr.onrender.com');
    
    setTimeout(initializeBot, 3000);
});
