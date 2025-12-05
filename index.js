const express = require('express');
const http = require('http');
const wppconnect = require('@wppconnect-team/wppconnect');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');

// ==================== إنشاء ملف index.html تلقائياً ====================
function createIndexHTML() {
    const htmlContent = `<!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>نظام البوت المطور</title>
    </head>
    <body>
        <h1>🤖 نظام البوت المطور</h1>
        <p>🎪 نظام الجلسات المتعددة جاهز (3 مستخدمين)</p>
    </body>
    </html>`;
    
    const htmlPath = path.join(__dirname, 'index.html');
    
    try {
        if (!fs.existsSync(htmlPath)) {
            fs.writeFileSync(htmlPath, htmlContent);
            console.log('✅ تم إنشاء ملف index.html');
        }
    } catch (error) {
        console.error('❌ خطأ في إنشاء index.html:', error.message);
    }
}

// استدعاء الدالة
createIndexHTML();
const app = express();
const server = http.createServer(app);
// ⭐ التعديل الأساسي: إضافة استيراد المكتبة

// ⭐ إعادة تكوين puppeteerConfig بشكل كامل

// إعداد Express
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// مجلدات البيانات
const dataDir = path.join(__dirname, 'data');
const sessionsDir = path.join(dataDir, 'sessions');
const repliesFile = path.join(dataDir, 'replies.json');
const settingsFile = path.join(dataDir, 'settings.json');
const problemsFile = path.join(dataDir, 'problems.json');
// ⭐ إضافة هنا: إعدادات Puppeteer للاستضافة السحابية
// ⭐ التعديل المقترح: إضافة executablePath
// ⭐⭐⭐ تعريف جميع المسارات أولاً ⭐⭐⭐
const multiSessionsDir = path.join(__dirname, 'multi_sessions');
function createDirectories() {
    const dirs = [multiSessionsDir]; // ✅ ضعها في مصفوفة
    dirs.forEach(dir => {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 تم إنشاء مجلد: ${dir}`);
            }
        } catch (error) {
            console.error(`❌ خطأ في إنشاء مجلد ${dir}:`, error.message);
        }
    });
}

// تنفيذ إنشاء المجلدات
createDirectories();



function cleanupChromiumFiles() {
    try {
        const tmpDir = '/tmp';
        if (fs.existsSync(tmpDir)) {
            const files = fs.readdirSync(tmpDir);
            files.forEach(file => {
                if (file.includes('chromium') || file.includes('puppeteer')) {
                    try {
                        const filePath = path.join(tmpDir, file);
                        fs.unlinkSync(filePath);
                        console.log(`🧹 تم تنظيف: ${filePath}`);
                    } catch (e) {
                        // تجاهل الأخطاء
                    }
                }
            });
        }
    } catch (error) {
        console.log('⚠️ خطأ في تنظيف الملفات:', error.message);
    }
}

// استدعاء قبل بدء البوت
cleanupChromiumFiles();



function cleanupOldSessions() {
    try {
        if (!fs.existsSync(multiSessionsDir)) {
            fs.mkdirSync(multiSessionsDir, { recursive: true });
            return;
        }
        
        const dirs = fs.readdirSync(multiSessionsDir);
        const now = Date.now();
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        let cleaned = 0;
        dirs.forEach(dir => {
            try {
                const dirPath = path.join(multiSessionsDir, dir);
                const stats = fs.statSync(dirPath);
                
                if (stats.isDirectory() && stats.mtimeMs < weekAgo) {
                    fs.rmSync(dirPath, { recursive: true, force: true });
                    cleaned++;
                    console.log(`🧹 تنظيف جلسة قديمة: ${dir}`);
                }
            } catch (error) {
                // تجاهل الأخطاء
            }
        });
        
        if (cleaned > 0) {
            console.log(`✅ تم تنظيف ${cleaned} جلسة قديمة`);
        }
    } catch (error) {
        console.log('⚠️ خطأ في تنظيف الجلسات:', error.message);
    }
}



class MultiSessionManager {
    constructor(maxSessions = 3) {
        this.maxSessions = maxSessions;
        this.activeSessions = new Map();
        this.sessionConfigs = new Map();
        this.loadSessionConfigs();
        console.log(`🎯 نظام الجلسات المتعددة جاهز (${maxSessions} مستخدمين)`);
    }

    loadSessionConfigs() {
        try {
            const configFile = path.join(dataDir, 'multi_sessions_config.json');
            if (fs.existsSync(configFile)) {
                const configs = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                configs.forEach(config => {
                    this.sessionConfigs.set(config.userId, config);
                });
                console.log(`📂 تم تحميل ${configs.length} تكوين جلسة`);
            }
        } catch (error) {
            console.log('⚠️ لا توجد تكوينات جلسات سابقة');
        }
    }

    saveSessionConfigs() {
        const configs = Array.from(this.sessionConfigs.values());
        const configFile = path.join(dataDir, 'multi_sessions_config.json');
        fs.writeFileSync(configFile, JSON.stringify(configs, null, 2));
    }

    async createSession(userId, userName, customConfig = {}) {
        if (this.activeSessions.size >= this.maxSessions) {
            throw new Error(`❌ وصلت للحد الأقصى للجلسات (${this.maxSessions})`);
        }

        const sessionId = `ms_${Date.now()}_${userId.replace(/[^0-9]/g, '')}`;
        const sessionDir = path.join(multiSessionsDir, sessionId);
        
        fs.mkdirSync(sessionDir, { recursive: true });

        const sessionConfig = {
            sessionId,
            userId,
            userName,
            dir: sessionDir,
            client: null,
            connected: false,
            qrCode: null,
            settings: this.getDefaultSessionSettings(userName),
            replies: this.getDefaultSessionReplies(userName),
            customData: {},
            createdAt: new Date().toISOString(),
            lastActive: Date.now(),
            ...customConfig
        };

        this.sessionConfigs.set(userId, sessionConfig);
        this.saveSessionConfigs();

        console.log(`✅ إنشاء جلسة لـ ${userName} (${sessionId})`);
        return sessionConfig;
    }

    async getPuppeteerOptions(userDataDir) {
        try {
            let executablePath;
            
            try {
                const chromium = require('@sparticuz/chromium');
                executablePath = await chromium.executablePath();
                console.log(`✅ [MultiSession] Using @sparticuz/chromium: ${executablePath}`);
            } catch (chromiumError) {
                console.log(`⚠️ [MultiSession] @sparticuz/chromium not available:`, chromiumError.message);
                
                const possiblePaths = [
                    process.env.PUPPETEER_EXECUTABLE_PATH,
                    process.env.CHROMIUM_PATH,
                    '/usr/bin/chromium-browser',
                    '/usr/bin/chromium',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/google-chrome'
                ].filter(Boolean);
                
                for (const path of possiblePaths) {
                    if (fs.existsSync(path)) {
                        executablePath = path;
                        break;
                    }
                }
            }
            
            return {
                headless: 'new',
                executablePath: executablePath || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ],
                userDataDir: userDataDir,
                timeout: 60000
            };
            
        } catch (error) {
            console.error(`❌ [MultiSession] Error getting puppeteer options:`, error);
            
            return {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ],
                userDataDir: userDataDir,
                timeout: 30000
            };
        }
    }

    // ⭐⭐ الدالة المعدلة - تعريف واحد فقط ⭐⭐
    async startSession(sessionConfig) {
        try {
            console.log(`🚀 [MultiSession] بدء جلسة WhatsApp لـ ${sessionConfig.userName}`);
            
            const puppeteerOptions = await this.getPuppeteerOptions(sessionConfig.dir);
            
            const client = await wppconnect.create({
                session: sessionConfig.sessionId,
                puppeteerOptions: puppeteerOptions,
                catchQR: (base64Qr, asciiQR) => {
                    console.log(`✅ [MultiSession] QR Code جاهز لـ ${sessionConfig.userName}`);
                    console.log(`📏 حجم QR Code: ${base64Qr ? base64Qr.length : 0} حرف`);
                    
                    if (!base64Qr) {
                        console.error(`❌ [MultiSession] QR Code فارغ لـ ${sessionConfig.userName}`);
                        return;
                    }
                    
                    // 1. حفظ مباشر في التكوين
                    sessionConfig.qrCode = base64Qr;
                    sessionConfig.qrGeneratedAt = new Date().toISOString();
                    
                    // 2. تحديث في الذاكرة
                    this.updateSessionConfig(sessionConfig.userId, { 
                        qrCode: base64Qr,
                        qrGeneratedAt: new Date().toISOString(),
                        lastQRUpdate: Date.now()
                    });
                    
                    // 3. حفظ في ملف
                    this.saveQRImage(sessionConfig, base64Qr);
                    
                    // 4. حفظ في ملف مؤقت للوصول الفوري
                    try {
                        const tempQrFile = path.join(multiSessionsDir, `${sessionConfig.userId}_qr.json`);
                        const tempData = {
                            userId: sessionConfig.userId,
                            userName: sessionConfig.userName,
                            qrCode: base64Qr,
                            sessionId: sessionConfig.sessionId,
                            generatedAt: new Date().toISOString()
                        };
                        
                        fs.writeFileSync(tempQrFile, JSON.stringify(tempData, null, 2));
                        console.log(`✅ [MultiSession] QR Code محفوظ في الملف المؤقت`);
                        
                    } catch (fileError) {
                        console.log(`⚠️ [MultiSession] خطأ في حفظ الملف المؤقت:`, fileError.message);
                    }
                },
                logQR: false,
                disableWelcome: true,
                autoClose: 0
            });

            sessionConfig.client = client;
            sessionConfig.connected = true;
            sessionConfig.connectedAt = new Date().toISOString();
            this.activeSessions.set(sessionConfig.sessionId, sessionConfig);

            this.setupSessionMessageHandler(client, sessionConfig);

            console.log(`🎉 [MultiSession] جلسة ${sessionConfig.userName} تعمل بنجاح!`);
            return { success: true, sessionConfig };

        } catch (error) {
            console.error(`❌ [MultiSession] خطأ في بدء جلسة ${sessionConfig.userName}:`, error.message);
            return await this.startSessionWithFallback(sessionConfig);
        }
    }

    // ⭐ دالة Fallback
    async startSessionWithFallback(sessionConfig) {
        try {
            console.log(`🔄 [MultiSession] محاولة Fallback`);
            
            const puppeteerOptions = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ],
                executablePath: '/usr/bin/chromium-browser',
                userDataDir: sessionConfig.dir,
                timeout: 30000
            };
            
            const client = await wppconnect.create({
                session: sessionConfig.sessionId,
                puppeteerOptions: puppeteerOptions,
                catchQR: (base64Qr) => {
                    console.log(`✅ [MultiSession Fallback] QR Code جاهز`);
                    sessionConfig.qrCode = base64Qr;
                    this.saveQRImage(sessionConfig, base64Qr);
                },
                disableWelcome: true
            });
            
            sessionConfig.client = client;
            sessionConfig.connected = true;
            this.activeSessions.set(sessionConfig.sessionId, sessionConfig);
            
            console.log(`✅ [MultiSession Fallback] جلسة ${sessionConfig.userName} تعمل`);
            return { success: true, sessionConfig, mode: 'fallback' };
            
        } catch (fallbackError) {
            console.error(`❌ [MultiSession] فشل Fallback:`, fallbackError.message);
            return { 
                success: false, 
                error: fallbackError.message
            };
        }
    }

    // ⭐ دالة saveQRImage - خارج startSession
    saveQRImage(sessionConfig, base64Qr) {
        try {
            if (!base64Qr) {
                console.log(`⚠️ [MultiSession] لا يوجد QR Code`);
                return;
            }
            
            // حفظ كـ txt
            const qrFile = path.join(sessionConfig.dir, 'qr_code.txt');
            fs.writeFileSync(qrFile, base64Qr);
            console.log(`✅ [MultiSession] QR محفوظ كـ txt`);
            
            // حفظ كـ json
            const qrJsonFile = path.join(sessionConfig.dir, 'qr_info.json');
            const qrInfo = {
                userId: sessionConfig.userId,
                userName: sessionConfig.userName,
                sessionId: sessionConfig.sessionId,
                qrCode: base64Qr,
                timestamp: new Date().toISOString()
            };
            fs.writeFileSync(qrJsonFile, JSON.stringify(qrInfo, null, 2));
            
        } catch (error) {
            console.log(`⚠️ [MultiSession] خطأ في حفظ QR:`, error.message);
        }
    }

    // ⭐ دالة checkSessionQR - خارج startSession
    checkSessionQR(userId) {
        try {
            const config = this.sessionConfigs.get(userId);
            if (!config) {
                return { exists: false, reason: 'التكوين غير موجود' };
            }
            
            const sources = [];
            
            if (config.qrCode) {
                sources.push('config_memory');
            }
            
            const qrTxtFile = path.join(config.dir, 'qr_code.txt');
            if (fs.existsSync(qrTxtFile)) {
                sources.push('txt_file');
            }
            
            const qrJsonFile = path.join(config.dir, 'qr_info.json');
            if (fs.existsSync(qrJsonFile)) {
                sources.push('json_file');
            }
            
            const tempQrFile = path.join(multiSessionsDir, `${userId}_qr.json`);
            if (fs.existsSync(tempQrFile)) {
                sources.push('temp_file');
            }
            
            return {
                exists: sources.length > 0,
                sources: sources,
                configExists: true,
                connected: config.connected || false,
                userName: config.userName
            };
            
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }

    setupSessionMessageHandler(client, sessionConfig) {
        client.onMessage(async (message) => {
            if (message.fromMe) return;
            
            sessionConfig.lastActive = Date.now();
            
            console.log(`📩 [${sessionConfig.userName}] رسالة من ${message.from.substring(0, 15)}...`);

            try {
                const response = await processUserInput(
                    message.from,
                    message.notifyName || 'عميل',
                    message.body || '',
                    client,
                    sessionConfig
                );

                if (response) {
                    await client.sendText(message.from, response);
                    console.log(`✅ [${sessionConfig.userName}] تم الرد`);
                }
            } catch (error) {
                console.error(`❌ [${sessionConfig.userName}] خطأ في المعالجة:`, error);
            }
        });

        client.onStateChange((state) => {
            console.log(`🔋 [${sessionConfig.userName}] حالة: ${state}`);
            sessionConfig.state = state;
        });
    }

    async sendWelcomeMessage(client, sessionConfig) {
        try {
            const welcomeMsg = `🎉 *تم توصيل البوت بنجاح!*\n\n` +
                             `👤 المستخدم: ${sessionConfig.userName}\n` +
                             `🏢 الشركة: ${sessionConfig.settings.companyName}\n` +
                             `⏰ الوقت: ${new Date().toLocaleString('ar-SA')}\n\n` +
                             `✅ البوت جاهز للرد التلقائي`;

            await client.sendText(client.info.wid._serialized, welcomeMsg);
        } catch (error) {
            console.log(`⚠️ لا يمكن إرسال رسالة الترحيب`);
        }
    }

    getDefaultSessionSettings(userName) {
        return {
            companyName: `${userName} للتقنية`,
            welcomeMessage: `مرحباً بك في نظام ${userName}! 🌟`,
            contactInfo: "للتواصل: 0555555555",
            autoReply: true,
            themeColor: "#25D366",
            sessionTimeout: 60,
            enableImages: true,
            enableLinks: true
        };
    }

    getDefaultSessionReplies(userName) {
        return {
            menus: {
                main: `🏢 *مرحباً بك في {companyName}*\n\n` +
                     `اختر الخدمة:\n\n` +
                     `1️⃣ أنظمة محاسبية\n` +
                     `2️⃣ أنظمة صرافة\n` +
                     `3️⃣ خدمات تصميم\n` +
                     `4️⃣ الأسعار\n` +
                     `5️⃣ تواصل المبيعات\n` +
                     `6️⃣ الإبلاغ عن مشكلة\n\n` +
                     `📝 أرسل رقم الخدمة`,
                accounting: `📊 *الأنظمة المحاسبية*\n\nاختر النظام:\n1️⃣ نظام محاسبي متكامل\n2️⃣ نظام فواتير\n0️⃣ رجوع`
            },
            quickReplies: {
                "مرحبا": `أهلاً وسهلاً بك في {companyName}! 😊`,
                "شكرا": `العفو! نحن هنا لخدمتك 🌟`
            }
        };
    }

    updateSessionConfig(userId, updates) {
        const config = this.sessionConfigs.get(userId);
        if (config) {
            Object.assign(config, updates);
            this.sessionConfigs.set(userId, config);
            this.saveSessionConfigs();
        }
    }

    getUserSession(userId) {
        for (let session of this.activeSessions.values()) {
            if (session.userId === userId) {
                return session;
            }
        }
        return null;
    }

    getActiveSessionsInfo() {
        return Array.from(this.activeSessions.values()).map(session => ({
            sessionId: session.sessionId,
            userName: session.userName,
            userId: session.userId,
            connected: session.connected,
            state: session.state,
            createdAt: session.createdAt,
            lastActive: new Date(session.lastActive).toLocaleString('ar-SA')
        }));
    }

    async stopSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session && session.client) {
            try {
                await session.client.close();
                console.log(`🛑 إيقاف جلسة ${session.userName}`);
            } catch (error) {
                console.error(`❌ خطأ في إيقاف الجلسة:`, error);
            }
        }
        this.activeSessions.delete(sessionId);
    }

    async startAllSavedSessions() {
        const configs = Array.from(this.sessionConfigs.values());
        console.log(`🔄 محاولة تشغيل ${configs.length} جلسة`);
        
        let started = 0;
        for (const config of configs.slice(0, this.maxSessions)) {
            if (!config.connected) {
                try {
                    const result = await this.startSession(config);
                    if (result.success) {
                        started++;
                        console.log(`✅ بدأت جلسة ${config.userName}`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (error) {
                    console.error(`❌ فشل بدء جلسة ${config.userName}:`, error.message);
                }
            }
        }
        
        return { started, total: configs.length };
    }
}

// إنشاء المدير
const multiSessionManager = new MultiSessionManager(3);
// ⭐ تعديل دالة processUserInput لدعم الجلسات المتعددة
async function processUserInput(userId, userName, text, client, sessionConfig = null) {
    // إذا كانت هناك جلسة محددة، استخدم إعداداتها
    if (sessionConfig) {
        return await processWithSessionConfig(userId, userName, text, client, sessionConfig);
    }
    
    // وإلا استخدم النظام الأساسي
    return await processWithDefaultSystem(userId, userName, text, client);
}

// ⭐ معالجة مع إعدادات الجلسة
async function processWithSessionConfig(userId, userName, text, client, sessionConfig) {
    const cleanText = text.trim().toLowerCase();
    
    // استخدام ردود الجلسة
    for (let keyword in sessionConfig.replies.quickReplies) {
        if (cleanText.includes(keyword.toLowerCase())) {
            let response = sessionConfig.replies.quickReplies[keyword];
            response = response.replace(/{companyName}/g, sessionConfig.settings.companyName)
                              .replace(/{userName}/g, userName);
            return response;
        }
    }
    
    // استخدام قوائم الجلسة
    if (cleanText === '1') {
        return sessionConfig.replies.menus.accounting;
    }
    
    // الرد الافتراضي للجلسة
    let mainMenu = sessionConfig.replies.menus.main;
    mainMenu = mainMenu.replace(/{companyName}/g, sessionConfig.settings.companyName);
    return mainMenu;
}

// ⭐ واجهات API الجديدة للجلسات المتعددة

// 1. إنشاء جلسة جديدة
app.post('/api/multi-sessions/create', async (req, res) => {
    try {
        const { userId, userName, customSettings } = req.body;
        
        if (!userId || !userName) {
            return res.status(400).json({ 
                success: false, 
                error: 'يجب إدخال userId و userName' 
            });
        }
        
        // إنشاء الجلسة
        const sessionConfig = await multiSessionManager.createSession(
            userId, 
            userName, 
            customSettings || {}
        );
        
        // بدء الجلسة (بدون انتظار)
        multiSessionManager.startSession(sessionConfig)
            .then(result => {
                console.log(`✅ بدأت جلسة ${userName}:`, result.success ? 'نجاح' : 'فشل');
            })
            .catch(error => {
                console.error(`❌ فشل بدء جلسة ${userName}:`, error);
            });
        
        res.json({
            success: true,
            sessionId: sessionConfig.sessionId,
            message: `✅ تم إنشاء جلسة لـ ${userName}`,
            note: 'جاري بدء الجلسة في الخلفية، تحقق من QR في لوحة التحكم'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 2. الحصول على QR Code للجلسة
app.get('/api/multi-sessions/:userId/qr', (req, res) => {
    const { userId } = req.params;
    const config = multiSessionManager.sessionConfigs.get(userId);
    
    if (!config) {
        return res.status(404).json({ 
            success: false, 
            error: 'الجلسة غير موجودة' 
        });
    }
    
    res.json({
        success: true,
        qrCode: config.qrCode,
        userName: config.userName,
        sessionId: config.sessionId,
        createdAt: config.createdAt
    });
});

// 3. تحديث إعدادات جلسة
app.post('/api/multi-sessions/:userId/settings', (req, res) => {
    const { userId } = req.params;
    const settings = req.body;
    
    multiSessionManager.updateSessionConfig(userId, { settings });
    
    res.json({
        success: true,
        message: 'تم تحديث إعدادات الجلسة'
    });
});

// 4. الحصول على جميع الجلسات النشطة
app.get('/api/multi-sessions', (req, res) => {
    res.json({
        success: true,
        maxSessions: multiSessionManager.maxSessions,
        activeCount: multiSessionManager.activeSessions.size,
        configCount: multiSessionManager.sessionConfigs.size,
        sessions: multiSessionManager.getActiveSessionsInfo(),
        configs: Array.from(multiSessionManager.sessionConfigs.values())
                      .map(c => ({ 
                          userId: c.userId, 
                          userName: c.userName,
                          sessionId: c.sessionId 
                      }))
    });
});

// 5. إرسال رسالة من خلال جلسة
app.post('/api/multi-sessions/:userId/send', async (req, res) => {
    const { userId } = req.params;
    const { to, message } = req.body;
    
    const session = multiSessionManager.getUserSession(userId);
    if (!session || !session.client) {
        return res.status(404).json({ 
            success: false, 
            error: 'الجلسة غير نشطة' 
        });
    }
    
    try {
        await session.client.sendText(to, message);
        res.json({ success: true, message: 'تم إرسال الرسالة' });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ⭐ تحديث واجهة المستخدم الحالية

// ============== صفحة منفصلة للجلسات المتعددة ==============
app.get('/multi-sessions', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🎪 نظام الجلسات المتعددة</title>

        
        <style>
            :root {
                --primary-color: #25D366;
                --secondary-color: #128C7E;
            }
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
                min-height: 100vh;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            }
            .header {
                background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                padding: 25px;
                text-align: center;
                color: white;
                border-radius: 15px;
                margin-bottom: 30px;
            }
            .header h1 {
                font-size: 2.2em;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .header p {
                font-size: 1.1em;
                opacity: 0.9;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .stat-card {
                background: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                border-left: 5px solid var(--primary-color);
            }
            .stat-number {
                font-size: 2.2em;
                font-weight: bold;
                color: var(--primary-color);
                margin-bottom: 8px;
            }
            .main-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
                margin-bottom: 30px;
            }
            @media (max-width: 768px) {
                .main-grid {
                    grid-template-columns: 1fr;
                }
            }
            .section {
                background: #f8f9fa;
                padding: 25px;
                border-radius: 15px;
                border: 2px solid #e9ecef;
            }
            .section h3 {
                color: var(--primary-color);
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #eee;
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
            }
            input {
                width: 100%;
                padding: 12px 15px;
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            input:focus {
                border-color: var(--primary-color);
                outline: none;
                box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
            }
            button {
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                transition: all 0.3s;
                box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
                width: 100%;
                margin-top: 10px;
            }
            button:hover {
                background: var(--secondary-color);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4);
            }
            .sessions-list {
                max-height: 400px;
                overflow-y: auto;
                padding: 15px;
                background: white;
                border-radius: 10px;
                border: 1px solid #e0e0e0;
            }
            .session-item {
                background: white;
                padding: 15px;
                margin: 10px 0;
                border-radius: 8px;
                border-left: 4px solid var(--primary-color);
                box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                transition: all 0.3s;
            }
            .session-item:hover {
                transform: translateX(5px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.12);
            }
            .session-connected {
                border-left-color: #28a745;
            }
            .session-disconnected {
                border-left-color: #dc3545;
            }
            .qr-container {
                text-align: center;
                padding: 20px;
                background: white;
                border-radius: 15px;
                margin-top: 20px;
                border: 2px dashed #ddd;
                display: none;
            }
            .back-btn {
                background: #6c757d;
                width: auto;
                padding: 10px 20px;
                margin-top: 20px;
            }
            .back-btn:hover {
                background: #5a6268;
            }
            // ⭐⭐ أضف هذا CSS في <style> ⭐⭐
.qr-display-container {
    background: linear-gradient(135deg, #ffffff, #f8f9fa);
    border-radius: 20px;
    padding: 30px;
    margin: 25px 0;
    border: 3px solid #25D366;
    box-shadow: 0 15px 35px rgba(37, 211, 102, 0.15);
    text-align: center;
    position: relative;
    overflow: hidden;
}

.qr-display-container::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, 
        transparent 30%, 
        rgba(37, 211, 102, 0.05) 50%, 
        transparent 70%);
    animation: shine 3s infinite linear;
}

@keyframes shine {
    0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
    100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
}

.qr-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 2px solid #e9ecef;
}

.qr-header h3 {
    margin: 0;
    color: #25D366;
    font-size: 1.6em;
    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.qr-icon {
    font-size: 2em;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

.qr-code-display {
    background: white;
    padding: 25px;
    border-radius: 15px;
    border: 2px dashed #25D366;
    margin: 0 auto 25px;
    max-width: 350px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
}

.qr-code-display:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 30px rgba(0,0,0,0.15);
}

.qr-image {
    max-width: 280px;
    border-radius: 10px;
    border: 3px solid #ffffff;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    transition: transform 0.3s;
}

.qr-image:hover {
    transform: scale(1.02);
}

.session-info {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 12px;
    margin: 20px 0;
    text-align: right;
    border-right: 4px solid #25D366;
}

.info-row {
    display: flex;
    justify-content: space-between;
    margin: 10px 0;
    padding: 8px 0;
    border-bottom: 1px solid #e9ecef;
}

.info-label {
    color: #6c757d;
    font-weight: 600;
}

.info-value {
    color: #343a40;
    font-weight: 700;
}

.qr-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin-top: 25px;
}

.qr-btn {
    padding: 12px 20px;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 1em;
}

.qr-btn-primary {
    background: linear-gradient(135deg, #25D366, #128C7E);
    color: white;
}

.qr-btn-secondary {
    background: #17a2b8;
    color: white;
}

.qr-btn-danger {
    background: #dc3545;
    color: white;
}

.qr-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 7px 15px rgba(0,0,0,0.2);
}

.qr-btn:active {
    transform: translateY(-1px);
}

.qr-status {
    margin-top: 20px;
    padding: 15px;
    border-radius: 10px;
    display: none;
}

.qr-status.success {
    background: #d4edda;
    color: #155724;
    border: 2px solid #c3e6cb;
}

.qr-status.error {
    background: #f8d7da;
    color: #721c24;
    border: 2px solid #f5c6cb;
}

.qr-timer {
    margin-top: 15px;
    padding: 10px;
    background: #fff3cd;
    border-radius: 8px;
    color: #856404;
    border: 1px solid #ffeaa7;
    font-weight: 600;
}

.countdown {
    font-size: 1.2em;
    color: #dc3545;
    font-weight: bold;
}

.qr-instructions {
    background: #e8f5e9;
    padding: 20px;
    border-radius: 12px;
    margin-top: 25px;
    border-right: 4px solid #28a745;
}

.qr-instructions ol {
    padding-right: 20px;
    margin: 10px 0;
}

.qr-instructions li {
    margin: 10px 0;
    line-height: 1.6;
}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎪 نظام الجلسات المتعددة</h1>
                <p>إدارة ما يصل إلى 3 جلسات WhatsApp مستقلة</p>
                <button onclick="window.location.href='/'" class="back-btn">
                    ⬅️ العودة للواجهة الرئيسية
                </button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number" id="maxSessions">3</div>
                    <div>🔢 الحد الأقصى للجلسات</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="activeSessionsCount">0</div>
                    <div>✅ الجلسات النشطة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="totalSessionsCount">0</div>
                    <div>📊 إجمالي الجلسات</div>
                </div>
            </div>
            
            <div class="main-grid">
                <div class="section">
                    <h3>➕ إنشاء جلسة جديدة</h3>
                    <div class="form-group">
                        <label>👤 اسم المستخدم:</label>
                        <input type="text" id="newSessionUserName" placeholder="مثال: أحمد للتقنية">
                    </div>
                    <div class="form-group">
                        <label>📱 رقم الهاتف:</label>
                        <input type="text" id="newSessionUserId" placeholder="مثال: 966555555555">
                    </div>
                    <button onclick="createMultiSession()">🚀 إنشاء جلسة جديدة</button>
                    <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px;">
                        <h4>📝 ملاحظات:</h4>
                        <ul style="padding-right: 20px;">
                            <li>الحد الأقصى: 3 جلسات متزامنة</li>
                            <li>كل جلسة لها إعداداتها الخاصة</li>
                            <li>سيظهر QR Code بعد الإنشاء</li>
                            <li>امسح QR Code بواسطة WhatsApp</li>
                        </ul>
                    </div>
                </div>
                
                <div class="section">
                    <h3>📊 الجلسات النشطة</h3>
                    <div class="sessions-list" id="multiSessionsList">
                        <div style="text-align: center; padding: 30px; color: #666;">
                            ⏳ جاري تحميل الجلسات...
                        </div>
                    </div>
                    <button onclick="loadMultiSessions()" style="background: #17a2b8;">
                        🔄 تحديث القائمة
                    </button>
                    <button onclick="refreshAllSessions()" style="background: #ffc107; color: #333;">
                        🔁 إعادة تشغيل جميع الجلسات
                    </button>
                </div>
            </div>
            
            <div id="sessionQRContainer" class="qr-container">
                <h3>📱 QR Code للجلسة</h3>
                <div id="sessionQRCode"></div>
                <p id="qrSessionInfo" style="margin-top: 10px;"></p>
                <button onclick="hideQR()" style="background: #6c757d; width: auto;">
                    ✖️ إخفاء QR Code
                </button>
            </div>
            
            <div class="section">
                <h3>⚙️ إدارة الجلسات</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <button onclick="startAllSessions()" style="background: #28a745;">
                        ▶️ تشغيل جميع الجلسات
                    </button>
                    <button onclick="stopAllSessions()" style="background: #dc3545;">
                        ⏹️ إيقاف جميع الجلسات
                    </button>
                    <button onclick="cleanupOldSessions()" style="background: #6c757d;">
                        🧹 تنظيف الجلسات القديمة
                    </button>
                    <button onclick="exportSessionsData()" style="background: #007bff;">
                        📥 تصدير بيانات الجلسات
                    </button>
                </div>
            </div>
            
            <!-- قسم الأدوات المتقدمة -->
            <div style="margin-top: 30px; background: #f8f9fa; padding: 20px; border-radius: 10px;">
                <h3>🔧 أدوات متقدمة</h3>
                
                <div style="margin: 15px 0;">
                    <label>🔍 التحقق من جلسة معينة:</label>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <input type="text" id="verifyUserId" placeholder="أدخل رقم الجلسة" style="flex: 1;">
                        <button onclick="verifySpecificSession()" style="background: #17a2b8;">
                            تحقق
                        </button>
                    </div>
                    <div id="verificationResult" style="display: none; margin-top: 15px; padding: 15px; background: white; border-radius: 8px;"></div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 20px;">
                    <a href="/api/multi-sessions" target="_blank" style="padding: 10px; background: #28a745; color: white; text-align: center; border-radius: 8px; text-decoration: none;">
                        📊 حالة جميع الجلسات
                    </a>
                    <button onclick="forceRefreshAll()" style="padding: 10px; background: #ffc107; color: #333; border-radius: 8px; border: none;">
                        🔄 إعادة تحميل الكل
                    </button>
                    <button onclick="showSystemInfo()" style="padding: 10px; background: #6c757d; color: white; border-radius: 8px; border: none;">
                        ℹ️ معلومات النظام
                    </button>
                </div>
            </div>
        </div>
        // ⭐⭐ أضف هذا في صفحة multi-sessions بعد قسم "الجلسات النشطة" ⭐⭐

<div class="qr-display-container" id="qrMainContainer" style="display: none;">
    <div class="qr-header">
        <div class="qr-icon">📱</div>
        <h3>عرض باركود الجلسة</h3>
    </div>
    
    <div class="session-info">
        <div class="info-row">
            <span class="info-label">👤 المستخدم:</span>
            <span class="info-value" id="qrUserName">--</span>
        </div>
        <div class="info-row">
            <span class="info-label">📱 الرقم:</span>
            <span class="info-value" id="qrUserId">--</span>
        </div>
        <div class="info-row">
            <span class="info-label">🆔 كود الجلسة:</span>
            <span class="info-value" id="qrSessionId">--</span>
        </div>
        <div class="info-row">
            <span class="info-label">⏰ وقت الإنشاء:</span>
            <span class="info-value" id="qrCreatedAt">--</span>
        </div>
        <div class="info-row">
            <span class="info-label">🔗 الحالة:</span>
            <span class="info-value" id="qrStatus">--</span>
        </div>
    </div>
    
    <div class="qr-code-display">
        <div id="qrImageContainer">
            <div style="padding: 40px; color: #6c757d; text-align: center;">
                <div style="font-size: 3em; margin-bottom: 15px;">📭</div>
                <h4>لم يتم تحميل الباركود</h4>
                <p>اختر جلسة من القائمة وانقر على "📱 عرض الباركود"</p>
            </div>
        </div>
    </div>
    
    <div class="qr-timer" id="qrTimer" style="display: none;">
        ⏳ الباركود صالح لمدة: <span class="countdown" id="qrCountdown">60</span> ثانية
    </div>
    
    <div class="qr-actions">
        <button class="qr-btn qr-btn-primary" onclick="generateNewQR()">
            🔄 إنشاء باركود جديد
        </button>
        <button class="qr-btn qr-btn-secondary" onclick="downloadQR()">
            📥 تحميل الباركود
        </button>
        <button class="qr-btn qr-btn-danger" onclick="hideQRContainer()">
            ✖️ إغلاق
        </button>
    </div>
    
    <div class="qr-instructions">
        <h4>📋 تعليمات الاستخدام:</h4>
        <ol>
            <li>افتح تطبيق WhatsApp على هاتفك</li>
            <li>اضغط على النقاط الثلاث (⋮) ← الأجهزة المرتبطة</li>
            <li>اضغط على "ربط جهاز"</li>
            <li>امسح الباركود المعروض أعلاه</li>
            <li>انتظر حتى يكتمل الربط (5-10 ثواني)</li>
        </ol>
        <p style="color: #dc3545; margin-top: 10px; font-weight: bold;">
            ⚠️ الباركود صالح لمدة 60 ثانية فقط
        </p>
    </div>
    
    <div id="qrStatusMessage" class="qr-status"></div>
</div>

<script>
// ⭐⭐ دوال إدارة الباركود ⭐⭐

// متغيرات التوقيت
let qrTimerInterval;
let qrCountdown = 60;

// عرض كونتينر الباركود
function showQRContainer(userId, userName, sessionId, createdAt) {
    // تحديث المعلومات
    document.getElementById('qrUserId').textContent = userId;
    document.getElementById('qrUserName').textContent = userName || 'غير معروف';
    document.getElementById('qrSessionId').textContent = sessionId ? sessionId.substring(0, 15) + '...' : '--';
    document.getElementById('qrCreatedAt').textContent = createdAt ? 
        new Date(createdAt).toLocaleString('ar-SA') : '--';
    
    // إظهار الكونتينر
    document.getElementById('qrMainContainer').style.display = 'block';
    
    // تحميل الباركود
    loadQRCode(userId);
    
    // بدء التوقيت
    startQRCountdown();
    
    // تمرير للكونتينر
    document.getElementById('qrMainContainer').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
    });
}

// إخفاء الكونتينر
function hideQRContainer() {
    document.getElementById('qrMainContainer').style.display = 'none';
    clearInterval(qrTimerInterval);
    showStatusMessage('تم إغلاق عارض الباركود', 'success');
}

// تحميل الباركود
async function loadQRCode(userId) {
    try {
        showLoadingState();
        
        const response = await fetch(\`/api/multi-sessions/\${userId}/qr\`);
        const data = await response.json();
        
        if (data.success && data.qrCode) {
            // عرض الباركود
            document.getElementById('qrImageContainer').innerHTML = 
                \`<img src="\${data.qrCode}" class="qr-image" alt="QR Code">\`;
            
            // تحديث الحالة
            document.getElementById('qrStatus').textContent = '✅ جاهز';
            document.getElementById('qrStatus').style.color = '#28a745';
            
            // إظهار التوقيت
            document.getElementById('qrTimer').style.display = 'block';
            
            // إعادة تعيين التوقيت
            resetCountdown();
            
            showStatusMessage('✅ تم تحميل الباركود بنجاح', 'success');
            
        } else {
            showErrorState(data.error || 'لا يوجد باركود للجلسة');
        }
        
    } catch (error) {
        showErrorState('خطأ في تحميل الباركود: ' + error.message);
    }
}

// إنشاء باركود جديد
async function generateNewQR() {
    const userId = document.getElementById('qrUserId').textContent;
    if (userId === '--') return;
    
    try {
        showLoadingState();
        
        // إرسال طلب لإنشاء باركود جديد
        const response = await fetch(\`/api/multi-sessions/\${userId}/refresh-qr\`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // انتظار ثم إعادة التحميل
            setTimeout(() => {
                loadQRCode(userId);
                showStatusMessage('✅ تم إنشاء باركود جديد', 'success');
            }, 2000);
        } else {
            showErrorState(data.error || 'فشل إنشاء باركود جديد');
        }
        
    } catch (error) {
        showErrorState('خطأ: ' + error.message);
    }
}

// تحميل الباركود كصورة
function downloadQR() {
    const qrImage = document.querySelector('.qr-image');
    if (!qrImage || !qrImage.src) {
        showStatusMessage('❌ لا يوجد باركود للتحميل', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.href = qrImage.src;
    link.download = \`whatsapp-qr-\${document.getElementById('qrUserId').textContent}-\${new Date().getTime()}.png\`;
    link.click();
    
    showStatusMessage('✅ تم بدء تحميل الباركود', 'success');
}

// بدء عد تنازلي
function startQRCountdown() {
    clearInterval(qrTimerInterval);
    qrCountdown = 60;
    
    qrTimerInterval = setInterval(() => {
        qrCountdown--;
        document.getElementById('qrCountdown').textContent = qrCountdown;
        
        if (qrCountdown <= 10) {
            document.getElementById('qrCountdown').style.color = '#dc3545';
        }
        
        if (qrCountdown <= 0) {
            clearInterval(qrTimerInterval);
            document.getElementById('qrImageContainer').innerHTML = \`
                <div style="padding: 40px; color: #dc3545; text-align: center;">
                    <div style="font-size: 3em; margin-bottom: 15px;">⏰</div>
                    <h4>انتهت صلاحية الباركود</h4>
                    <button onclick="generateNewQR()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; margin-top: 10px;">
                        🔄 إنشاء باركود جديد
                    </button>
                </div>
            \`;
        }
    }, 1000);
}

// إعادة تعيين التوقيت
function resetCountdown() {
    qrCountdown = 60;
    document.getElementById('qrCountdown').textContent = qrCountdown;
    document.getElementById('qrCountdown').style.color = '#dc3545';
}

// عرض حالة التحميل
function showLoadingState() {
    document.getElementById('qrImageContainer').innerHTML = \`
        <div style="padding: 50px; text-align: center;">
            <div style="font-size: 2em; color: #17a2b8; margin-bottom: 15px;">
                <div class="spinner"></div>
            </div>
            <h4 style="color: #17a2b8;">جاري تحميل الباركود...</h4>
            <p>يرجى الانتظار</p>
        </div>
    \`;
    
    document.getElementById('qrStatus').textContent = '⏳ جاري التحميل';
    document.getElementById('qrStatus').style.color = '#17a2b8';
}

// عرض حالة الخطأ
function showErrorState(message) {
    document.getElementById('qrImageContainer').innerHTML = \`
        <div style="padding: 40px; color: #dc3545; text-align: center;">
            <div style="font-size: 3em; margin-bottom: 15px;">❌</div>
            <h4>فشل تحميل الباركود</h4>
            <p>\${message}</p>
            <button onclick="loadQRCode('\${document.getElementById('qrUserId').textContent}')" 
                    style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; margin-top: 10px;">
                🔄 إعادة المحاولة
            </button>
        </div>
    \`;
    
    document.getElementById('qrStatus').textContent = '❌ خطأ';
    document.getElementById('qrStatus').style.color = '#dc3545';
    document.getElementById('qrTimer').style.display = 'none';
}

// عرض رسالة حالة
function showStatusMessage(message, type) {
    const statusDiv = document.getElementById('qrStatusMessage');
    statusDiv.textContent = message;
    statusDiv.className = \`qr-status \${type}\`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// أضف هذا النمط للـ Spinner
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = \`
.spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #25D366;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
\`;
document.head.appendChild(spinnerStyle);

// ⭐⭐ تعديل زر عرض الباركود في قائمة الجلسات ⭐⭐
// في دالة loadMultiSessions، عدل الزر:
html += \`
<button onclick="showQRForSession('\${session.userId}', '\${session.userName}', '\${session.sessionId}', '\${session.createdAt}')" 
        style="padding: 5px 10px; font-size: 0.9em; background: #17a2b8; width: auto; margin-left: 5px;">
    📱 عرض الباركود
</button>
\`;

// دالة عرض الباركود للجلسة
function showQRForSession(userId, userName, sessionId, createdAt) {
    showQRContainer(userId, userName, sessionId, createdAt);
}
</script>
        <script>
            // تحميل الإحصائيات الأولية
            async function loadStats() {
                try {
                    const response = await fetch('/api/multi-sessions');
                    const data = await response.json();
                    
                    if (data.success) {
                        document.getElementById('activeSessionsCount').textContent = 
                            data.activeCount || 0;
                        document.getElementById('totalSessionsCount').textContent = 
                            data.configCount || 0;
                        document.getElementById('maxSessions').textContent = 
                            data.maxSessions || 3;
                    }
                } catch (error) {
                    console.error('خطأ في تحميل الإحصائيات:', error);
                }
            }
            
            // دالة إنشاء جلسة جديدة
            async function createMultiSession() {
                const userName = document.getElementById('newSessionUserName').value.trim();
                const userId = document.getElementById('newSessionUserId').value.trim();
                
                if (!userName || !userId) {
                    alert('⚠️ الرجاء إدخال جميع البيانات المطلوبة');
                    return;
                }
                
                if (!userId.match(/^[0-9]{10,15}$/)) {
                    alert('❌ رقم الهاتف غير صالح. يرجى إدخال 10-15 رقم');
                    return;
                }
                
                try {
                    const response = await fetch('/api/multi-sessions/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            userName, 
                            userId,
                            customSettings: {
                                companyName: userName + ' للتقنية',
                                autoReply: true,
                                enableImages: true
                            }
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ ' + result.message);
                        document.getElementById('newSessionUserName').value = '';
                        document.getElementById('newSessionUserId').value = '';
                        
                        loadMultiSessions();
                        loadStats();
                        
                        setTimeout(() => {
                            showSessionQR(userId, userName);
                        }, 1000);
                    } else {
                        alert('❌ ' + (result.error || 'حدث خطأ'));
                    }
                } catch (error) {
                    alert('❌ خطأ في الاتصال: ' + error.message);
                }
            }
            
            // تحميل قائمة الجلسات
            async function loadMultiSessions() {
                try {
                    const response = await fetch('/api/multi-sessions');
                    const data = await response.json();
                    
                    let html = '';
                    if (data.success && data.sessions && data.sessions.length > 0) {
                        data.sessions.forEach(session => {
                            html += \`
                            <div class="session-item \${session.connected ? 'session-connected' : 'session-disconnected'}">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="font-size: 1.1em;">\${session.userName}</strong><br>
                                        <small style="color: #666;">\${session.userId}</small>
                                    </div>
                                    <div style="text-align: left;">
                                        <span style="padding: 4px 8px; background: \${session.connected ? '#d4edda' : '#f8d7da'}; 
                                              color: \${session.connected ? '#155724' : '#721c24'}; 
                                              border-radius: 4px; font-size: 0.9em;">
                                            \${session.connected ? '✅ متصل' : '❌ غير متصل'}
                                        </span>
                                    </div>
                                </div>
                                <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                                    🕐 آخر نشاط: \${session.lastActive || 'غير معروف'}
                                </div>
                                <div style="margin-top: 10px; display: flex; gap: 10px;">
                                    <button onclick="showSessionQR('\${session.userId}', '\${session.userName}')" 
                                            style="padding: 5px 10px; font-size: 0.9em; background: #17a2b8; width: auto;">
                                        📱 QR Code
                                    </button>

                                    <button onclick="startSessionNow('\${session.userId}')" 
                                            style="padding: 5px 10px; font-size: 0.9em; background: #28a745; width: auto;">
                                        ▶️ بدء الجلسة
                                    </button>
                                </div>
                            </div>
                            \`;

                            // في دالة loadMultiSessions، أضف هذا الزر:

                        });
                    } else {
                        html = \`
                        <div style="text-align: center; padding: 40px; color: #666;">
                            <div style="font-size: 3em; margin-bottom: 15px;">📭</div>
                            <h3>لا توجد جلسات نشطة</h3>
                            <p>قم بإنشاء جلسة جديدة لبدء الاستخدام</p>
                        </div>
                        \`;
                        
                    }
                    
                    document.getElementById('multiSessionsList').innerHTML = html;
                } catch (error) {
                    console.error('خطأ في تحميل الجلسات:', error);
                    document.getElementById('multiSessionsList').innerHTML = \`
                    <div style="text-align: center; padding: 30px; color: #dc3545;">
                        <h3>❌ خطأ في تحميل الجلسات</h3>
                        <p>\${error.message}</p>
                    </div>
                    \`;
                }
            }
            
            // عرض QR Code للجلسة
            async function showSessionQR(userId, userName = '') {
                try {
                    const response = await fetch(\`/api/multi-sessions/\${userId}/qr\`);
                    const data = await response.json();
                    
                    if (data.success && data.qrCode) {
                        document.getElementById('sessionQRCode').innerHTML = 
                            \`<img src="\${data.qrCode}" style="max-width: 300px; border: 2px solid #ddd; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">\`;
                        
                        document.getElementById('qrSessionInfo').innerHTML = 
                            \`<strong>\${userName || data.userName || 'مستخدم'}</strong>\`;
                        
                        document.getElementById('sessionQRContainer').style.display = 'block';
                        
                        document.getElementById('sessionQRContainer').scrollIntoView({ behavior: 'smooth' });
                    } else {
                        alert('❌ لا يوجد QR Code للجلسة');
                    }
                } catch (error) {
                    alert('❌ خطأ في الحصول على QR Code: ' + error.message);
                }
            }
            
            // إخفاء QR Code
            function hideQR() {
                document.getElementById('sessionQRContainer').style.display = 'none';
            }
            
            // دالة التحقق من جلسة محددة
            async function verifySpecificSession() {
                const userId = document.getElementById('verifyUserId').value.trim();
                if (!userId) {
                    alert('الرجاء إدخال رقم الجلسة');
                    return;
                }
                
                try {
                    const response = await fetch(\`/api/multi-sessions/\${userId}/verify\`);
                    const data = await response.json();
                    
                    let message = \`🔍 نتيجة التحقق للجلسة \${userId}:\n\n\`;
                    message += \`✅ QR Code موجود: \${data.exists ? 'نعم' : 'لا'}\n\`;
                    message += \`📁 مصادر التخزين: \${data.sources?.join(', ') || 'لا يوجد'}\n\`;
                    message += \`👤 اسم المستخدم: \${data.userName || 'غير معروف'}\n\`;
                    
                    const resultDiv = document.getElementById('verificationResult');
                    if (resultDiv) {
                        resultDiv.innerHTML = message;
                        resultDiv.style.display = 'block';
                    } else {
                        alert(message);
                    }
                    
                } catch (error) {
                    alert('❌ خطأ في التحقق: ' + error.message);
                }
            }
            
            // تشغيل جميع الجلسات
            async function startAllSessions() {
                if (confirm('هل تريد تشغيل جميع الجلسات المحفوظة؟')) {
                    try {
                        const response = await fetch('/api/multi-sessions/start-all', {
                            method: 'POST'
                        });
                        
                        const result = await response.json();
                        alert(result.message || '✅ جاري تشغيل جميع الجلسات');
                        setTimeout(() => {
                            loadMultiSessions();
                            loadStats();
                        }, 3000);
                    } catch (error) {
                        alert('❌ خطأ: ' + error.message);
                    }
                }
            }
            
            // إيقاف جميع الجلسات
            async function stopAllSessions() {
                if (confirm('هل تريد إيقاف جميع الجلسات النشطة؟')) {
                    try {
                        const response = await fetch('/api/multi-sessions/stop-all', {
                            method: 'POST'
                        });
                        
                        const result = await response.json();
                        alert(result.message || '✅ تم إيقاف جميع الجلسات');
                        loadMultiSessions();
                        loadStats();
                    } catch (error) {
                        alert('❌ خطأ: ' + error.message);
                    }
                }
            }
            
            // تنظيف الجلسات القديمة
            async function cleanupOldSessions() {
                if (confirm('هل تريد تنظيف جميع الجلسات الأقدم من أسبوع؟')) {
                    try {
                        const response = await fetch('/api/multi-sessions/cleanup', {
                            method: 'POST'
                        });
                        
                        const result = await response.json();
                        alert(result.message || '✅ تم التنظيف');
                        loadMultiSessions();
                        loadStats();
                    } catch (error) {
                        alert('❌ خطأ: ' + error.message);
                    }
                }
            }
            
            // تصدير بيانات الجلسات
            async function exportSessionsData() {
                try {
                    const response = await fetch('/api/multi-sessions/export');
                    const data = await response.json();
                    
                    const dataStr = JSON.stringify(data, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(dataBlob);
                    link.download = \`sessions-data-\${new Date().toISOString().split('T')[0]}.json\`;
                    link.click();
                    
                    alert('✅ تم تصدير بيانات الجلسات');
                } catch (error) {
                    alert('❌ خطأ في التصدير: ' + error.message);
                }
            }
            // بدء جلسة يدوياً
        async function startSessionNow(userId) {
             try {
                 const response = await fetch(\`/api/multi-sessions/\${userId}/start-now\`, {
                 method: 'POST'
                });
        
                const result = await response.json();
        
                if (result.success) {
                      alert('✅ ' + result.message);
            
            // انتظار ثم تحديث
                      setTimeout(() => {
                      loadMultiSessions();
                      loadStats();
                      alert('⏳ انتظر 15-30 ثانية ثم اضغط على 📱 QR Code');
                      }, 2000);
            
                } else {
                    alert('❌ ' + result.error);
          }
    } catch (error) {
        alert('❌ خطأ: ' + error.message);
    }
}
            // إعادة تشغيل جميع الجلسات
            async function refreshAllSessions() {
                if (confirm('هل تريد إعادة تشغيل جميع الجلسات؟')) {
                    try {
                        await stopAllSessions();
                        setTimeout(async () => {
                            await startAllSessions();
                        }, 2000);
                    } catch (error) {
                        alert('❌ خطأ: ' + error.message);
                    }
                }
            }
            
            // إعادة تحميل جميع الجلسات
            async function forceRefreshAll() {
                if (confirm('هل تريد إعادة تحميل جميع الجلسات؟')) {
                    try {
                        const response = await fetch('/api/multi-sessions/refresh-all', {
                            method: 'POST'
                        });
                        const result = await response.json();
                        alert(result.message || '✅ تم التحديث');
                        setTimeout(() => location.reload(), 2000);
                    } catch (error) {
                        alert('❌ خطأ: ' + error.message);
                    }
                }
            }
            
            // معلومات النظام
            async function showSystemInfo() {
                try {
                    const response = await fetch('/api/system-info');
                    const data = await response.json();
                    
                    let info = '🖥️ معلومات النظام:\\n\\n';
                    info += \`📊 نظام التشغيل: \${data.platform}\\n\`;
                    info += \`🔢 عدد الجلسات: \${data.sessionCount}\\n\`;
                    info += \`⏰ وقت التشغيل: \${Math.floor(data.uptime)} ثانية\`;
                    
                    alert(info);
                } catch (error) {
                    alert('❌ لا يمكن تحميل المعلومات');
                }
            }
            
            // التحميل الأولي
            document.addEventListener('DOMContentLoaded', () => {
                loadStats();
                loadMultiSessions();
                
                setInterval(() => {
                    loadMultiSessions();
                    loadStats();
                }, 10000);
                
                document.getElementById('newSessionUserId').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        createMultiSession();
                    }
                });
            });
        </script>
    </body>
    </html>
    `);
});

// ============== إضافة APIs جديدة لدعم الصفحة المنفصلة ==============
// بدء جلسة موجودة
app.post('/api/multi-sessions/:userId/start-now', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const config = multiSessionManager.sessionConfigs.get(userId);
        
        if (!config) {
            return res.status(404).json({ 
                success: false, 
                error: 'الجلسة غير موجودة' 
            });
        }
        
        console.log(`🚀 بدء يدوي للجلسة ${config.userName}`);
        
        const startResult = await multiSessionManager.startSession(config);
        
        if (startResult.success) {
            // انتظار لإنشاء QR Code
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const qrCheck = multiSessionManager.checkSessionQR(userId);
            
            res.json({
                success: true,
                message: `✅ بدأت جلسة ${config.userName}`,
                qrAvailable: qrCheck.exists,
                note: qrCheck.exists ? 
                    'QR Code جاهز الآن' :
                    'انتظر 10-30 ثانية ثم حاول مجدداً'
            });
        } else {
            res.json({
                success: false,
                error: startResult.error,
                note: 'جرب الطريقة البديلة Fallback'
            });
        }
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});


// صفحة مباشرة لبدء الجلسة وعرض QR
app.get('/start-session/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const config = multiSessionManager.sessionConfigs.get(userId);
        
        if (!config) {
            return res.send(`
            <html>
            <body style="text-align: center; padding: 50px;">
                <h1>❌ الجلسة غير موجودة</h1>
                <p>رقم الجلسة: ${userId}</p>
                <a href="/multi-sessions">العودة</a>
            </body>
            </html>
            `);
        }
        
        // محاولة بدء الجلسة
        const startResult = await multiSessionManager.startSession(config);
        
        if (startResult.success) {
            // انتظار 5 ثواني
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // التحقق من QR Code
            const qrCheck = multiSessionManager.checkSessionQR(userId);
            
            let qrHtml = '';
            if (qrCheck.exists) {
                // قراءة QR Code من الملف
                let qrCode = null;
                const qrFile = path.join(config.dir, 'qr_code.txt');
                
                if (fs.existsSync(qrFile)) {
                    qrCode = fs.readFileSync(qrFile, 'utf8');
                } else if (config.qrCode) {
                    qrCode = config.qrCode;
                }
                
                if (qrCode) {
                    qrHtml = \`
                    <h2>✅ QR Code جاهز!</h2>
                    <img src="\${qrCode}" style="max-width: 300px; border: 2px solid #25D366; border-radius: 10px;">
                    <p>امسح هذا الكود بواسطة WhatsApp</p>
                    \`;
                }
            }
            
            res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>بدء جلسة ${config.userName}</title>
                <style>
                    body { text-align: center; padding: 50px; font-family: Arial; }
                    .success { color: #28a745; }
                    .info { background: #e8f5e9; padding: 20px; border-radius: 10px; margin: 20px; }
                </style>
            </head>
            <body>
                <h1 class="success">✅ بدأت جلسة ${config.userName}</h1>
                
                <div class="info">
                    <p><strong>👤 المستخدم:</strong> ${config.userName}</p>
                    <p><strong>📱 الرقم:</strong> ${userId}</p>
                    <p><strong>🆔 كود الجلسة:</strong> ${config.sessionId}</p>
                    <p><strong>⏰ وقت البدء:</strong> ${new Date().toLocaleString('ar-SA')}</p>
                </div>
                
                ${qrHtml || \`
                <div class="info">
                    <h3>⏳ جاري إنشاء QR Code...</h3>
                    <p>يرجى الانتظار 15-30 ثانية</p>
                    <button onclick="window.location.reload()" style="padding: 10px 20px; background: #25D366; color: white; border: none; border-radius: 5px;">
                        🔄 تحديث الصفحة
                    </button>
                </div>
                \`}
                
                <div style="margin-top: 30px;">
                    <a href="/multi-sessions" style="padding: 10px 20px; background: #6c757d; color: white; text-decoration: none; border-radius: 5px;">
                        العودة للصفحة الرئيسية
                    </a>
                </div>
                
                <script>
                    // تحديث تلقائي بعد 30 ثانية
                    setTimeout(() => {
                        window.location.reload();
                    }, 30000);
                </script>
            </body>
            </html>
            `);
            
        } else {
            res.send(`
            <html>
            <body style="text-align: center; padding: 50px;">
                <h1>❌ فشل بدء الجلسة</h1>
                <p>${startResult.error || 'خطأ غير معروف'}</p>
                <a href="/multi-sessions">العودة</a>
            </body>
            </html>
            `);
        }
        
    } catch (error) {
        res.send(`<h1>خطأ: ${error.message}</h1>`);
    }
});
// 6. إيقاف جلسة معينة
app.post('/api/multi-sessions/:userId/stop', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const session = multiSessionManager.getUserSession(userId);
        if (session) {
            await multiSessionManager.stopSession(session.sessionId);
            res.json({ success: true, message: `تم إيقاف جلسة ${session.userName}` });
        } else {
            res.status(404).json({ success: false, error: 'الجلسة غير نشطة' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. تشغيل جميع الجلسات المحفوظة
app.post('/api/multi-sessions/start-all', async (req, res) => {
    try {
        const configs = Array.from(multiSessionManager.sessionConfigs.values());
        let started = 0;
        
        for (const config of configs.slice(0, 3)) {
            if (!config.connected) {
                await multiSessionManager.startSession(config);
                started++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        res.json({ 
            success: true, 
            message: `تم تشغيل ${started} جلسة`,
            started 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. إيقاف جميع الجلسات
app.post('/api/multi-sessions/stop-all', async (req, res) => {
    try {
        const sessions = Array.from(multiSessionManager.activeSessions.values());
        let stopped = 0;
        
        for (const session of sessions) {
            await multiSessionManager.stopSession(session.sessionId);
            stopped++;
        }
        
        res.json({ 
            success: true, 
            message: `تم إيقاف ${stopped} جلسة`,
            stopped 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9. تنظيف الجلسات القديمة
app.post('/api/multi-sessions/cleanup', (req, res) => {
    try {
        cleanupOldSessions();
        res.json({ 
            success: true, 
            message: 'تم تنظيف الجلسات القديمة' 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 10. تصدير بيانات الجلسات
app.get('/api/multi-sessions/export', (req, res) => {
    try {
        const sessions = Array.from(multiSessionManager.activeSessions.values());
        const configs = Array.from(multiSessionManager.sessionConfigs.values());
        
        const exportData = {
            timestamp: new Date().toISOString(),
            activeSessions: sessions.map(s => ({
                userId: s.userId,
                userName: s.userName,
                sessionId: s.sessionId,
                connected: s.connected,
                createdAt: s.createdAt
            })),
            savedConfigs: configs.map(c => ({
                userId: c.userId,
                userName: c.userName,
                sessionId: c.sessionId,
                createdAt: c.createdAt
            })),
            statistics: {
                maxSessions: multiSessionManager.maxSessions,
                activeCount: sessions.length,
                configCount: configs.length
            }
        };
        
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== حذف المسار المتعارض ==============
// ⭐ تعليق أو حذف هذا المسار كاملاً:
/*
app.get('/', (req, res) => {
    // قراءة HTML الحالي
    let html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    
    // إضافة قسم الجلسات المتعددة
    const multiSessionsSection = `...`;
    
    const updatedHtml = html.replace(
        '<!-- الإعدادات المتقدمة -->',
        multiSessionsSection + '\n\n<!-- الإعدادات المتقدمة -->'
    );
    
    res.send(updatedHtml);
});
*/

// ============== تعديل الواجهة الرئيسية لإضافة رابط للصفحة المنفصلة ==============

// في الواجهة الرئيسية (app.get('/', ...)) أضف هذا في قسم التبويبات:
// <div class="tab" onclick="window.open('/multi-sessions', '_blank')">🎪 جلسات متعددة</div>

async function initializeAllSystems() {
    console.log('🚀 بدء جميع أنظمة البوت...');
    
    // 1. تحميل النظام الأساسي
    console.log('📦 تحميل النظام الأساسي...');
    
    // 2. تنظيف الجلسات القديمة
   cleanupOldSessions();
    
    // 3. بدء الجلسات المحفوظة تلقائياً
    autoStartSavedSessions();
    
    console.log('✅ جميع الأنظمة جاهزة');
}







////////////////






// التأكد من وجود المجلدات
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir);

// بديل عن uuid بدون مكتبات إضافية
function generateId() {
    return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () => 
        Math.floor(Math.random() * 16).toString(16)
    );
}

// البيانات الافتراضية
let customReplies = {
    companyName: "شركتك",
    welcomeMessage: "مرحباً بك! 🌟 كيف يمكنني مساعدتك اليوم؟",
    contactInfo: "للتواصل: 0555555555",
    
    // القوائم الرئيسية مع الأزرار التفاعلية
    menus: {
        main: `🏢 *مرحباً بك في {companyName}* 🌟

اختر الخدمة التي تريدها:

1️⃣ أنظمة محاسبية
2️⃣ أنظمة شركات الصرافة 
3️⃣ خدمات التصميم
4️⃣ الأسعار والعروض
5️⃣ التواصل مع المبيعات
6️⃣ الإبلاغ عن مشكلة

📝 أرسل رقم الخدمة`,

        accounting: `📊 *الأنظمة المحاسبية* 💰

اختر النظام الذي تريد معرفة المزيد عنه:

1️⃣ نظام المحاسبة المتكامل
2️⃣ نظام إدارة الفواتير
3️⃣ نظام إدارة المخزون
4️⃣ نظام الموارد البشرية
5️⃣ نظام إدارة المصروفات
0️⃣ رجوع للقائمة الرئيسية`,

        exchange: `💱 *أنظمة شركات الصرافة* 🏦

اختر النظام الذي تريد معرفة المزيد عنه:

1️⃣ نظام إدارة الصرافة المركزي
2️⃣ نظام تتبع العملات
3️⃣ نظام إدارة الفروع
4️⃣ نظام التقارير المالية
5️⃣ نظام الأمان والمراقبة
0️⃣ رجوع للقائمة الرئيسية`,

        design: `🎨 *خدمات التصميم* ✨

اختر الخدمة التي تريدها:

1️⃣ تصميم شعارات احترافية
2️⃣ هوية بصرية متكاملة
3️⃣ تصميم مواقع إلكترونية
4️⃣ تصميم تطبيقات جوال
5️⃣ تصميم مواد تسويقية
0️⃣ رجوع للقائمة الرئيسية`
    },

    // التفاصيل الكاملة للأنظمة مع دعم الصور والروابط
    systemDetails: {
    "accounting.1": {
        title: "💎 نظام الدوت اكس برو الذهبي",
        description: `✨ *النظام الشامل لإدارة الأعمال المتقدمة*\n\n🏆 *الميزات الرئيسية:*\n• إدارة متكاملة لجميع الأقسام\n• تحليلات مالية متقدمة  \n• ذكاء اصطناعي للتنبؤ المالي\n• تقارير لحظية عبر الويب\n• أنظمة أمنية متعددة المستويات\n\n🎯 *المزايا:*\n✅ شاشات تحكم قابلة للتخصيص\n✅ دعم متعدد اللغات والعملات\n✅ تكامل مع الأنظمة الحكومية\n✅ نسخ احتياطي تلقائي\n✅ دعم فني 24/7\n\n📞 *للحصول على عرض سعر مخصص:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.2": {
        title: "🏪 نظام التاجر",
        description: `🛒 *الحل الأمثل لإدارة المتاجر والمحلات*\n\n🔄 *الميزات الرئيسية:*\n• فواتير مبيعات ومشتريات\n• متابعة حركة البضاعة\n• إدارة المبيعات النقدية والآجلة\n• نظام العروض والتخفيضات\n• تقارير المبيعات اليومية\n\n🎯 *المزايا:*\n✅ واجهة مستخدم بسيطة وسهلة\n✅ دعم الباركود والماسح الضوئي\n✅ إدارة الموردين والعملاء\n✅ تقارير أرباح وخسائر\n✅ نسخ احتياطي آلي\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.3": {
        title: "⛽ نظام محطات الوقود",
        description: `🚗 *نظام متكامل لمحطات البنزين والوقود*\n\n🛢️ *الميزات الرئيسية:*\n• متابعة خزانات الوقود\n• إدارة مضخات الوقود\n• تقارير المبيعات لكل مضخة\n• جرد آلي للوقود\n• إدارة البقالة والخدمات\n\n🎯 *المزايا:*\n✅ تكامل مع أنظمة الدفع\n✅ تقارير البنك المركزي\n✅ إدارة الموظفين والمناوبات\n✅ نظام نقاط وبطاقات الولاء\n✅ مراقبة آنية للمخزون\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.4": {
        title: "⚡ نظام محطات الكهرباء",
        description: `💡 *نظام متخصص لشركات الكهرباء والطاقة*\n\n🔌 *الميزات الرئيسية:*\n• إدارة المشتركين والفوترة\n• متابعة استهلاك الطاقة\n• إدارة الصيانة والشكاوى\n• حسابات الفواتير والتحصيل\n• تقارير أداء المحطات\n\n🎯 *المزايا:*\n✅ تكامل مع العدادات الذكية\n✅ نظام إنذار للأعطال\n✅ إدارة الفروع والمحطات\n✅ تقارير استهلاك الطاقة\n✅ دعم متعدد المناطق\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.5": {
        title: "💧 نظام مشاريع المياه",
        description: `🌊 *نظام متكامل لشركات المياه والصرف الصحي*\n\n🚰 *الميزات الرئيسية:*\n• إدارة المشتركين والاشتراكات\n• مراقبة استهلاك المياه\n• إدارة شبكات المياه والصرف\n• متابعة جودة المياه\n• نظام الفوترة والتحصيل\n\n🎯 *المزايا:*\n✅ تكامل مع العدادات الذكية\n✅ نظام إنذار للتسربات\n✅ إدارة المشاريع والمقاولين\n✅ تقارير الاستهلاك الشهري\n✅ دعم القطاع الحكومي والخاص\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.6": {
        title: "👥 نظام الموارد البشرية",
        description: `💼 *نظام متكامل لإدارة رأس المال البشري*\n\n📋 *الميزات الرئيسية:*\n• إدارة بيانات الموظفين\n• نظام الرواتب والحوافز\n• إدارة الإجازات والغياب\n• تقييم الأداء والمؤهلات\n• تقارير الموارد البشرية\n\n🎯 *المزايا:*\n✅ نظام حضور وانصراف\n✅ إدارة التدريب والتطوير\n✅ توثيق العقود والمستندات\n✅ تقارير إحصائية متقدمة\n✅ تكامل مع الأنظمة الحكومية\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.7": {
        title: "🏥 نظام المستشفيات",
        description: `💊 *نظام متكامل لإدارة المستشفيات والمراكز الطبية*\n\n👨‍⚕️ *الميزات الرئيسية:*\n• إدارة المرضى والملفات الطبية\n• إدارة الصيدلية والمستودعات\n• حجوزات العيادات والمواعيد\n• الفواتير الطبية والتأمين\n• تقارير الأداء الطبي\n\n🎯 *المزايا:*\n✅ تكامل مع الأجهزة الطبية\n✅ إدارة الغرف والأسرة\n✅ نظام الوصفات الطبية\n✅ تقارير إحصائية صحية\n✅ دعم التأمين الصحي\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.8": {
        title: "✈️ نظام السفريات والسياحة",
        description: `🏨 *نظام متكامل لشركات السياحة والسفر*\n\n🌴 *الميزات الرئيسية:*\n• إدارة الحجوزات والفنادق\n• حجز الطيران والقطارات\n• برامج الجولات السياحية\n• إدارة العملاء والوكلاء\n• تقارير المبيعات والعمولات\n\n🎯 *المزايا:*\n✅ تكامل مع شركات الطيران\n✅ نظام حجوزات آلي\n✅ إدارة الفيزات والتأشيرات\n✅ تقارير الأداء السياحي\n✅ دعم متعدد اللغات\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.9": {
        title: "🚀 نظام التاجر المطور",
        description: `🛍️ *نسخة متطورة من نظام التاجر الأساسي*\n\n📈 *الميزات الإضافية:*\n• تحليلات مبيعات متقدمة\n• إدارة متعددة الفروع\n• نظام ولاء متكامل\n• تقارير تنبؤية\n• تطبيقات جوال للموظفين\n\n🎯 *المزايا:*\n✅ لوحة تحكم متطورة\n✅ تقارير ذكية وتنبؤات\n✅ إدارة علاقات العملاء\n✅ تكامل مع منصات التجارة الإلكترونية\n✅ دعم اتخاذ القرارات\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    },
    "accounting.10": {
        title: "🌐 النظام المالي المحاسبي",
        description: `💻 *نظام محاسبي متكامل يعمل عبر الويب*\n\n📊 *الميزات الرئيسية:*\n• الحسابات العامة والميزانيات\n• قيود اليومية والمستندات\n• التقارير المالية المتكاملة\n• إدارة المصروفات والإيرادات\n• تكامل مع البنوك والزكاة\n\n🎯 *المزايا:*\n✅ وصول آمن من أي مكان\n✅ تقارير مالية فورية\n✅ متوافق مع أنظمة الضريبة\n✅ دعم متعدد العملات\n✅ نسخ احتياطي سحابي\n\n📞 *للحصول على العرض:* {contactInfo}`,
        image: "",
        link: ""
    }
},
    // إعدادات المشاكل والمجموعات
    problemsConfig: {
        groupId: "", // الرقم المعرف للمجموعة
        autoForward: true,
        notifyAdmins: true,
        admins: ["123456789@c.us"] // أرقام المشرفين
    },

    // الردود السريعة
    quickReplies: {
        "مرحبا": "{welcomeMessage}",
        "اهلا": "{welcomeMessage}",
        "الخدمات": "{main}",
        "شكرا": "العفو! 😊 نحن هنا لخدمتك"
    }
};

let settings = {
    autoReply: true,
    themeColor: "#25D366",
    sessionTimeout: 30, // دقيقة
    enableImages: true,
    enableLinks: true
};

// تحميل البيانات المحفوظة
try {
    if (fs.existsSync(repliesFile)) {
        const saved = JSON.parse(fs.readFileSync(repliesFile, 'utf8'));
        customReplies = { ...customReplies, ...saved };
    }
    if (fs.existsSync(settingsFile)) {
        settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) };
    }
      
} catch (error) {
    console.log('جاري استخدام الإعدادات الافتراضية');
}

// حالة البوت
let botState = {
    isConnected: false,
    client: null,
    qrCode: null
};

// نظام التصفية الذكي للمحادثات
// نظام التصفية الذكي للمحادثات
class SmartFilter {
    constructor() {
        this.knownContacts = new Set();
        this.businessKeywords = [
            "سعر", "خدمة", "نظام", "محاسبي", "برنامج", "شركة",
            "عميل", "طلب", "عرض", "سوفت", "محاسبة", "دعم", "تكلفة",
            "سعر", "شرح", "معلومات", "باقة", "عروض", "خصم", "أنظمة",
            "محاسبة", "فواتير", "مخزون", "موارد", "بشرية", "مستشفى",
            "سياحة", "سفر", "صرافة", "كهرباء", "مياه", "وقود"
        ];
        this.personalKeywords = [
            "هلا", "شلونك", "اخبارك", "وينك", "باي", "تصبحون",
            "صباح", "مساء", "نورت", "الله", "يسلمك", "الحمدلله",
            "انشالله", "ماقصرت", "يعطيك", "العافية", "وين", "شكرا",
            "تها", "يا", "غلا", "حبي", "عسل", "روح", "قلبي"
        ];
    }

    // التحقق إذا كان الرقم لعميل محتمل
    async shouldReply(message, client) {
        const filters = settings.advancedFilters;
        if (!filters.enableContactFilter) return true;

        const from = message.from;
        const messageText = message.body || '';
        
        // 1. التحقق من طول الرسالة
        if (messageText.length < filters.minMessageLength) {
            console.log('🚫 تم تجاهل رسالة قصيرة:', messageText);
            return false;
        }

        // 2. التحقق من الكلمات المستبعدة
        if (this.containsExcludedKeywords(messageText)) {
            console.log('🚫 تم تجاهل رسالة تحتوي على رموز مستبعدة');
            return false;
        }

        // 3. التحقق من جهات الاتصال المحفوظة
        if (!filters.replyToSavedContacts) {
            try {
                const isContact = await this.isSavedContact(from, client);
                if (isContact) {
                    console.log('🚫 تم تجاهل رسالة من جهة اتصال محفوظة');
                    return false;
                }
            } catch (error) {
                console.log('⚠️ خطأ في التحقق من جهة الاتصال:', error);
            }
        }

        // 4. تحليل محتوى الرسالة
        const isBusinessMessage = this.isBusinessRelated(messageText);
        const isPersonalMessage = this.isPersonalMessage(messageText);

        console.log('🔍 تحليل الرسالة:', {
            نص: messageText.substring(0, 30),
            عمل: isBusinessMessage,
            شخصية: isPersonalMessage
        });

        // 5. قرار الرد بناءً على تحليل المحتوى
        if (isBusinessMessage && !isPersonalMessage) {
            console.log('✅ رسالة عمل - سيتم الرد');
            return true;
        }

        if (filters.replyToUnknownNumbers && !isPersonalMessage) {
            console.log('✅ رقم مجهول ورسالة غير شخصية - سيتم الرد');
            return true;
        }

        console.log('🚫 تم تجاهل الرسالة بناءً على التصفية');
        return false;
    }

    // التحقق إذا كانت الرسالة متعلقة بالأعمال
    isBusinessRelated(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return this.businessKeywords.some(keyword => 
            lowerText.includes(keyword.toLowerCase())
        );
    }

    // التحقق إذا كانت الرسالة شخصية
    isPersonalMessage(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return this.personalKeywords.some(keyword => 
            lowerText.includes(keyword.toLowerCase())
        );
    }

    // التحقق من الكلمات المستبعدة
    containsExcludedKeywords(text) {
        if (!text) return false;
        return settings.advancedFilters.excludeKeywords.some(keyword => 
            text.includes(keyword)
        );
    }

    // التحقق إذا كان الرقم محفوظ في جهات الاتصال
    async isSavedContact(phoneNumber, client) {
        try {
            // محاولة التحقق من جهات الاتصال
            const contact = await client.getContact(phoneNumber);
            return contact && contact.isMyContact;
        } catch (error) {
            // إذا لم تعمل الدالة، نعتبر أن الرقم ليس محفوظاً
            console.log('⚠️ لا يمكن التحقق من جهة الاتصال، نعتبره غير محفوظ');
            return false;
        }
    }

    // إضافة رقم لقائمة المعرفة
    addKnownContact(phoneNumber) {
        this.knownContacts.add(phoneNumber);
        console.log('📝 تم إضافة الرقم لقائمة المعرفة:', phoneNumber);
    }

    // التحقق إذا كان الرقم معروف
    isKnownContact(phoneNumber) {
        return this.knownContacts.has(phoneNumber);
    }
}

const smartFilter = new SmartFilter();
// نظام إدارة الجلسات المحسّن
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.loadSessions();
    }

    getSession(userId) {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, {
                currentMenu: 'main',
                history: ['main'],
                data: {},
                lastActivity: Date.now(),
                userId: userId
            });
            this.saveSession(userId);
        }
        return this.sessions.get(userId);
    }

    updateSession(userId, updates) {
        const session = this.getSession(userId);
        Object.assign(session, updates, { lastActivity: Date.now() });
        this.saveSession(userId);
        return session;
    }

    saveSession(userId) {
        const session = this.sessions.get(userId);
        if (session) {
            fs.writeFileSync(
                path.join(sessionsDir, `${userId.replace(/[^a-zA-Z0-9]/g, '_')}.json`),
                JSON.stringify(session, null, 2)
            );
        }
    }

    loadSessions() {
        try {
            const files = fs.readdirSync(sessionsDir);
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const sessionData = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
                    const userId = sessionData.userId;
                    this.sessions.set(userId, sessionData);
                }
            });
            console.log(`✅ تم تحميل ${this.sessions.size} جلسة`);
        } catch (error) {
            console.log('⚠️ لا توجد جلسات سابقة');
        }
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        const timeoutMs = settings.sessionTimeout * 60 * 1000;
        
        for (let [userId, session] of this.sessions) {
            if (now - session.lastActivity > timeoutMs) {
                this.sessions.delete(userId);
                try {
                    fs.unlinkSync(path.join(sessionsDir, `${userId.replace(/[^a-zA-Z0-9]/g, '_')}.json`));
                } catch (error) {}
            }
        }
    }
}

const sessionManager = new SessionManager();

// نظام إدارة المشاكل
class ProblemManager {
    constructor() {
        this.problems = this.loadProblems();
    }

    addProblem(userId, userName, problem, category = 'عام') {
        const problemData = {
            id: generateId(),
            userId,
            userName,
            problem,
            category,
            status: 'new',
            timestamp: new Date().toISOString(),
            messages: []
        };

        this.problems.push(problemData);
        this.saveProblems();
        return problemData;
    }

    addMessage(problemId, message, fromUser = true) {
        const problem = this.problems.find(p => p.id === problemId);
        if (problem) {
            problem.messages.push({
                message,
                fromUser,
                timestamp: new Date().toISOString()
            });
            this.saveProblems();
        }
    }

    updateStatus(problemId, status) {
        const problem = this.problems.find(p => p.id === problemId);
        if (problem) {
            problem.status = status;
            this.saveProblems();
        }
    }

    saveProblems() {
        fs.writeFileSync(problemsFile, JSON.stringify(this.problems, null, 2));
    }

    loadProblems() {
        try {
            return fs.existsSync(problemsFile) ? 
                JSON.parse(fs.readFileSync(problemsFile, 'utf8')) : [];
        } catch (error) {
            return [];
        }
    }

    getProblemsByStatus(status) {
        return this.problems.filter(p => p.status === status);
    }
}

const problemManager = new ProblemManager();

// حفظ البيانات
function saveData() {
    try {
        fs.writeFileSync(repliesFile, JSON.stringify(customReplies, null, 2));
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('خطأ في حفظ البيانات:', error);
    }
}

// معالجة النصوص مع المتغيرات
function processText(text, userData = {}) {
    return text
        .replace(/{companyName}/g, customReplies.companyName)
        .replace(/{welcomeMessage}/g, customReplies.welcomeMessage)
        .replace(/{main}/g, customReplies.menus.main)
        .replace(/{contactInfo}/g, customReplies.contactInfo)
        .replace(/{userName}/g, userData.name || 'عميلنا العزيز');
}

// نظام معالجة الرسائل المحسّن
async function processUserInput(userId, userName, text, client) {
    const session = sessionManager.getSession(userId);
    const cleanText = text.trim().toLowerCase();
    
    // التحقق من حالة الإبلاغ عن مشكلة
    if (session.reportingProblem) {
        return await handleProblemReport(userId, userName, text, client, session);
    }

    // الردود السريعة أولاً
    for (let keyword in customReplies.quickReplies) {
        if (cleanText.includes(keyword.toLowerCase())) {
            sessionManager.updateSession(userId, {
                currentMenu: 'main',
                history: ['main']
            });
            return processText(customReplies.quickReplies[keyword], { name: userName });
        }
    }

    // معالجة الأوامر الخاصة
    if (cleanText === '0' || cleanText === '٠') {
        return handleBackCommand(userId, session);
    }

    if (cleanText === '6' || cleanText === '٦') {
        return startProblemReport(userId, session);
    }

    if (cleanText === '7' || cleanText === '٧') {
        return handleProblemFollowUp(userId, userName, session);
    }

    // معالجة القوائم
    let response = '';
    let nextMenu = session.currentMenu;

    switch (session.currentMenu) {
        case 'main':
            response = await handleMainMenu(cleanText, userId, session, userName);
            break;
            
        case 'accounting':
        case 'exchange':
        case 'design':
            response = await handleSubMenu(cleanText, userId, session, userName, client);
            break;
        
        case 'problem_followup':
            return handleProblemFollowUpMessage(userId, userName, text, session);
       
        default:
            response = processText(customReplies.menus.main, { name: userName });
            sessionManager.updateSession(userId, { currentMenu: 'main', history: ['main'] });
    }

    return response;
}

// دالة متابعة المشكلة السابقة
function handleProblemFollowUp(userId, userName, session) {
    const userProblems = problemManager.problems.filter(p => p.userId === userId);
    
    if (userProblems.length === 0) {
        return `❌ *لا توجد مشاكل مسجلة لديك*\n\nلم تقم بالإبلاغ عن أي مشكلة سابقة.\n\n٦️⃣ للإبلاغ عن مشكلة جديدة\n٠️⃣ رجوع للقائمة الرئيسية`;
    }
    
    const activeProblems = userProblems.filter(p => p.status !== 'resolved');
    const resolvedProblems = userProblems.filter(p => p.status === 'resolved');
    
    let response = `📋 *مشاكلك السابقة*\n\n`;
    
    if (activeProblems.length > 0) {
        response += `*🔄 المشاكل النشطة:*\n`;
        activeProblems.forEach(problem => {
            response += `\n🔸 #${problem.id.substring(0, 8)} - ${problem.category}\n`;
            response += `   📝 ${problem.problem.substring(0, 50)}...\n`;
            response += `   📊 الحالة: ${getStatusText(problem.status)}\n`;
            response += `   ⏰ ${new Date(problem.timestamp).toLocaleDateString('ar-SA')}\n`;
        });
    }
    
    if (resolvedProblems.length > 0) {
        response += `\n*✅ المشاكل المكتملة:*\n`;
        resolvedProblems.forEach(problem => {
            response += `\n🔹 #${problem.id.substring(0, 8)} - ${problem.category}\n`;
            response += `   📝 ${problem.problem.substring(0, 50)}...\n`;
        });
    }
    
    response += `\n📨 لإرسال رسالة إضافية لمشكلة معينة، أرسل:\n*رسالة #رقم_التذكرة* متبوعاً برسالتك\n\n٠️⃣ رجوع للقائمة الرئيسية`;
    
    sessionManager.updateSession(userId, {
        currentMenu: 'problem_followup',
        history: [...session.history, 'problem_followup']
    });
    
    return response;
}

// الحصول على نص الحالة
function getStatusText(status) {
    const statusMap = {
        'new': '🆕 جديدة',
        'pending': '🔄 قيد المعالجة', 
        'resolved': '✅ مكتملة'
    };
    return statusMap[status] || status;
}

// دالة معالجة الرسائل في متابعة المشاكل
function handleProblemFollowUpMessage(userId, userName, text, session) {
    const cleanText = text.trim();
    
    if (cleanText.startsWith('رسالة #') || cleanText.startsWith('رساله #')) {
        return handleAddMessageToProblem(userId, userName, cleanText, session);
    }
    
    return `❌ *أمر غير صحيح*\n\n📨 لإرسال رسالة لمشكلة، أرسل:\n*رسالة #رقم_التذكرة* متبوعاً برسالتك\n\n٠️⃣ رجوع للقائمة الرئيسية`;
}

// إضافة رسالة لمشكلة موجودة
function handleAddMessageToProblem(userId, userName, text, session) {
    // استخراج رقم التذكرة والرسالة
    const parts = text.split(' ');
    if (parts.length < 3) {
        return `❌ *صيغة غير صحيحة*\n\nاستخدم: *رسالة #رقم_التذكرة رسالتك*\nمثال: رسالة #a1b2c3d4 أريد تحديث عن حالة المشكلة`;
    }
    
    const ticketNumber = parts[1].replace('#', '');
    const message = parts.slice(2).join(' ');
    
    // البحث عن المشكلة
    const problem = problemManager.problems.find(p => 
        p.id.includes(ticketNumber) && p.userId === userId
    );
    
    if (!problem) {
        return `❌ *لم يتم العثور على التذكرة* #${ticketNumber}\n\nتأكد من رقم التذكرة أو أن المشكلة مسجلة باسمك.`;
    }
    
    // إضافة الرسالة
    problemManager.addMessage(problem.id, message, true);
    
    // إشعار المشرفين
    if (botState.client && customReplies.problemsConfig.notifyAdmins) {
        notifyNewMessage(problem, message, userName);
    }
    
    return `✅ *تم إرسال رسالتك للمشكلة* #${ticketNumber}\n\n📝 رسالتك: ${message}\n\nسيتم الرد عليك قريباً.\n\n٠️⃣ رجوع للقائمة الرئيسية`;
}

// إشعار المشرفين برسالة جديدة
async function notifyNewMessage(problem, message, userName) {
    try {
        const groupId = customReplies.problemsConfig.groupId;
        if (!groupId) return;

        const notification = `💬 *رسالة جديدة على المشكلة*\n\n👤 العميل: ${userName}\n📞 الرقم: ${problem.userId}\n🔢 التذكرة: #${problem.id.substring(0, 8)}\n📝 الرسالة: ${message}\n\n⏰ الوقت: ${new Date().toLocaleString('ar-SA')}`;

        await botState.client.sendText(groupId, notification);
        
        // إشعار المشرفين individually
        if (customReplies.problemsConfig.admins) {
            for (let admin of customReplies.problemsConfig.admins) {
                await botState.client.sendText(admin, `🔔 ${notification}`);
            }
        }
    } catch (error) {
        console.log('⚠️ خطأ في إرسال إشعار الرسالة:', error);
    }
}
// معالجة القائمة الرئيسية
async function handleMainMenu(cleanText, userId, session, userName) {
    let nextMenu = session.currentMenu;
    let response = '';

    switch (cleanText) {
        case '1': case '١':
            nextMenu = 'accounting';
            session.history.push('accounting');
            response = processText(customReplies.menus.accounting, { name: userName });
            break;
        case '2': case '٢':
            nextMenu = 'exchange';
            session.history.push('exchange');
            response = processText(customReplies.menus.exchange, { name: userName });
            break;
        case '3': case '٣':
            nextMenu = 'design';
            session.history.push('design');
            response = processText(customReplies.menus.design, { name: userName });
            break;
        case '4': case '٤':
            response = getPricingMenu();
            break;
        case '5': case '٥':
            response = getContactMenu();
            break;
        // في دالة handleMainMenu - إضافة case جديدة:
        case '6': case '٦':
            return handleProblemFollowUp(userId, userName, session);
        default:
            response = `❌ *خيار غير صحيح*\n\n${processText(customReplies.menus.main, { name: userName })}`;
    }

    sessionManager.updateSession(userId, { currentMenu: nextMenu, history: session.history });
    return response;
}



// متابعة المشكلة السابقة
function handleProblemFollowUp(userId, userName, session) {
    const userProblems = problemManager.problems.filter(p => p.userId === userId);
    
    if (userProblems.length === 0) {
        return `❌ *لا توجد مشاكل مسجلة لديك*\n\nلم تقم بالإبلاغ عن أي مشكلة سابقة.\n\n6️⃣ للإبلاغ عن مشكلة جديدة\n0️⃣ رجوع للقائمة الرئيسية`;
    }
    
    const activeProblems = userProblems.filter(p => p.status !== 'resolved');
    const resolvedProblems = userProblems.filter(p => p.status === 'resolved');
    
    let response = `📋 *مشاكلك السابقة*\n\n`;
    
    if (activeProblems.length > 0) {
        response += `*🔄 المشاكل النشطة:*\n`;
        activeProblems.forEach(problem => {
            response += `\n🔸 #${problem.id.substring(0, 8)} - ${problem.category}\n`;
            response += `   📝 ${problem.problem.substring(0, 50)}...\n`;
            response += `   📊 الحالة: ${getStatusText(problem.status)}\n`;
            response += `   ⏰ ${new Date(problem.timestamp).toLocaleDateString('ar-SA')}\n`;
        });
    }
    
    if (resolvedProblems.length > 0) {
        response += `\n*✅ المشاكل المكتملة:*\n`;
        resolvedProblems.forEach(problem => {
            response += `\n🔹 #${problem.id.substring(0, 8)} - ${problem.category}\n`;
            response += `   📝 ${problem.problem.substring(0, 50)}...\n`;
        });
    }
    
    response += `\n📨 لإرسال رسالة إضافية لمشكلة معينة، أرسل:\n*رسالة #رقم_التذكرة* متبوعاً برسالتك\n\n0️⃣ رجوع للقائمة الرئيسية`;
    
    sessionManager.updateSession(userId, {
        currentMenu: 'problem_followup',
        history: [...session.history, 'problem_followup']
    });
    
    return response;
}

// الحصول على نص الحالة
function getStatusText(status) {
    const statusMap = {
        'new': '🆕 جديدة',
        'pending': '🔄 قيد المعالجة', 
        'resolved': '✅ مكتملة'
    };
    return statusMap[status] || status;
}

// معالجة القوائم الفرعية
async function handleSubMenu(cleanText, userId, session, userName, client) {
    const systemKey = `${session.currentMenu}.${cleanText}`;
    
    if (customReplies.systemDetails[systemKey]) {
        return await sendSystemDetails(systemKey, userId, session, userName, client);
    } else {
        return `❌ *خيار غير صحيح*\n\n${processText(customReplies.menus[session.currentMenu], { name: userName })}`;
    }
}

// إرسال تفاصيل النظام مع الصور والروابط
async function sendSystemDetails(systemKey, userId, session, userName, client) {
    const system = customReplies.systemDetails[systemKey];
    let response = system.description;
    
    // إرسال الصورة إذا كانت موجودة
    if (system.image && settings.enableImages) {
        try {
            await client.sendImage(
                userId,
                system.image,
                'system_image.jpg',
                system.title
            );
        } catch (error) {
            console.log('⚠️ خطأ في إرسال الصورة:', error);
        }
    }
    
    // إرسال الرابط إذا كان موجوداً
    if (system.link && settings.enableLinks) {
        response += `\n\n🔗 *رابط إضافي:* ${system.link}`;
    }

    // إضافة أزرار تفاعلية
    response += `\n\n📞 *للاتصال:* ${customReplies.contactInfo}\n0️⃣ رجوع للقائمة السابقة`;

    sessionManager.updateSession(userId, { 
        currentMenu: session.currentMenu,
        lastSystem: systemKey 
    });

    return processText(response, { name: userName });
}

// التعامل مع أمر الرجوع
function handleBackCommand(userId, session) {
    if (session.history.length > 1) {
        session.history.pop();
        const previousMenu = session.history[session.history.length - 1];
        sessionManager.updateSession(userId, { 
            currentMenu: previousMenu,
            history: session.history 
        });
        return processText(customReplies.menus[previousMenu]);
    } else {
        return processText(customReplies.menus.main);
    }
}

// بدء الإبلاغ عن مشكلة
function startProblemReport(userId, session) {
    sessionManager.updateSession(userId, {
        reportingProblem: true,
        problemStep: 'category'
    });

    return `📝 *الإبلاغ عن مشكلة*\n\nالرجاء اختيار نوع المشكلة:\n\n1️⃣ مشكلة فنية\n2️⃣ استفسار عن خدمة\n3️⃣ شكوى\n4️⃣ اقتراح\n0️⃣ إلغاء`;
}

// التعامل مع الإبلاغ عن مشكلة
async function handleProblemReport(userId, userName, text, client, session) {
    const cleanText = text.trim().toLowerCase();

    if (cleanText === '0' || cleanText === '٠') {
        sessionManager.updateSession(userId, {
            reportingProblem: false,
            problemStep: null
        });
        return processText(customReplies.menus.main, { name: userName });
    }

    if (!session.problemCategory && session.problemStep === 'category') {
        const categories = {
            '1': 'مشكلة فنية',
            '2': 'استفسار عن خدمة', 
            '3': 'شكوى',
            '4': 'اقتراح'
        };

        const category = categories[cleanText];
        if (category) {
            sessionManager.updateSession(userId, {
                problemCategory: category,
                problemStep: 'description'
            });
            return `📝 *${category}*\n\nالرجاء وصف المشكلة بالتفصيل:\n\n0️⃣ إلغاء`;
        } else {
            return `❌ *اختيار غير صحيح*\n\nالرجاء اختيار نوع المشكلة:\n\n1️⃣ مشكلة فنية\n2️⃣ استفسار عن خدمة\n3️⃣ شكوى\n4️⃣ اقتراح\n0️⃣ إلغاء`;
        }
    }

    if (session.problemCategory && session.problemStep === 'description') {
        // حفظ المشكلة
        const problem = problemManager.addProblem(userId, userName, text, session.problemCategory);
        
        // إرسال إشعار للمجموعة إذا كان مضبوطاً
        if (customReplies.problemsConfig.groupId && customReplies.problemsConfig.autoForward) {
            await notifyProblemGroup(problem, client);
        }

        sessionManager.updateSession(userId, {
            reportingProblem: false,
            problemStep: null,
            problemCategory: null
        });

        return `✅ *تم استلام مشكلتك*\n\nرقم التذكرة: #${problem.id.substring(0, 8)}\nسيتم الرد عليك في أقرب وقت ممكن.\n\nشكراً لتواصلك معنا! 😊`;
    }

    return `❌ *خطأ في النظام*`;
}

// إشعار المجموعة بالمشكلة
async function notifyProblemGroup(problem, client) {
    try {
        const groupId = customReplies.problemsConfig.groupId;
        if (!groupId) return;

        const message = `🚨 *مشكلة جديدة*\n\n👤 *العميل:* ${problem.userName}\n📞 *رقمه:* ${problem.userId}\n📝 *النوع:* ${problem.category}\n🔢 *رقم التذكرة:* #${problem.id.substring(0, 8)}\n\n📄 *الوصف:*\n${problem.problem}\n\n⏰ *الوقت:* ${new Date(problem.timestamp).toLocaleString('ar-SA')}`;

        await client.sendText(groupId, message);
        
        // إشعار المشرفين
        if (customReplies.problemsConfig.notifyAdmins) {
            for (let admin of customReplies.problemsConfig.admins) {
                await client.sendText(admin, `🔔 ${message}`);
            }
        }
    } catch (error) {
        console.log('⚠️ خطأ في إرسال إشعار المشكلة:', error);
    }
}
// تحميل البيانات المحفوظة
try {
    if (fs.existsSync(repliesFile)) {
        const saved = JSON.parse(fs.readFileSync(repliesFile, 'utf8'));
        customReplies = { ...customReplies, ...saved };
    }
    if (fs.existsSync(settingsFile)) {
        settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) };
    }
    
    // ✅ الإصلاح: تأكد من وجود advancedFilters
    if (!settings.advancedFilters) {
        settings.advancedFilters = {
            enableContactFilter: false,
            replyToUnknownNumbers: true,
            replyToSavedContacts: false,
            minMessageLength: 3,
            excludeKeywords: ["😂", "❤️", "😍", "👍", "😘", "✨"],
            businessHours: {
                enabled: false,
                start: "09:00",
                end: "17:00",
                timezone: "Asia/Riyadh"
            }
        };
        console.log('✅ تم إنشاء الإعدادات المتقدمة الجديدة');
        saveData(); // حفظ تلقائي
    }
} catch (error) {
    console.log('جاري استخدام الإعدادات الافتراضية');
}
// حفظ الإعدادات المتقدمة
// حفظ الإعدادات المتقدمة
async function saveAdvancedSettings() {
    // استخدام القيم الافتراضية بشكل آمن
    const advancedSettings = {
        enableContactFilter: document.getElementById('enableContactFilter').checked,
        replyToUnknownNumbers: document.getElementById('replyToUnknownNumbers').checked,
        replyToSavedContacts: document.getElementById('replyToSavedContacts').checked,
        minMessageLength: parseInt(document.getElementById('minMessageLength').value) || 3,
        excludeKeywords: document.getElementById('excludeKeywords').value.split(',').map(k => k.trim()).filter(k => k),
        businessHours: settings.advancedFilters?.businessHours || {
            enabled: false,
            start: "09:00",
            end: "17:00", 
            timezone: "Asia/Riyadh"
        }
    };

    console.log('📤 إعدادات المرسلة:', advancedSettings); // للتdebug

    try {
        const response = await fetch('/api/advanced-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(advancedSettings)
        });
        
        if (!response.ok) {
            throw new Error(`خطأ في الخادم: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📥 رد الخادم:', result); // للتdebug
        
        if (result.success) {
            alert('✅ تم حفظ إعدادات التصفية بنجاح');
            // إعادة تحميل البيانات لتأكيد الحفظ
            setTimeout(() => {
                loadData();
                loadFilterStats();
            }, 500);
        } else {
            alert('❌ خطأ: ' + (result.error || 'فشل في الحفظ'));
        }
    } catch (error) {
        console.error('❌ خطأ في الاتصال:', error);
        alert('❌ خطأ في الاتصال: ' + error.message);
    }
}
// تحميل إحصائيات التصفية
// تحميل إحصائيات التصفية
async function loadFilterStats() {
    try {
        const response = await fetch('/api/filter-stats');
        
        if (!response.ok) {
            throw new Error(`خطأ في الخادم: ${response.status}`);
        }
        
        const stats = await response.json();
        console.log('📊 إحصائيات التصفية:', stats);
        
        document.getElementById('knownContactsCount').textContent = stats.knownContacts || 0;
        document.getElementById('filteredMessages').textContent = stats.knownContacts || 0;
        
        // تحديث الإعدادات في الواجهة بشكل آمن
        if (stats.filters) {
            document.getElementById('enableContactFilter').checked = Boolean(stats.filters.enableContactFilter);
            document.getElementById('replyToUnknownNumbers').checked = Boolean(stats.filters.replyToUnknownNumbers);
            document.getElementById('replyToSavedContacts').checked = Boolean(stats.filters.replyToSavedContacts);
            document.getElementById('minMessageLength').value = stats.filters.minMessageLength || 3;
            document.getElementById('excludeKeywords').value = Array.isArray(stats.filters.excludeKeywords) ? 
                stats.filters.excludeKeywords.join(', ') : '😂, ❤️, 😍, 👍';
        }
    } catch (error) {
        console.log('⚠️ خطأ في تحميل إحصائيات التصفية:', error);
    }
}
// اختبار التصفية
function testFilter() {
    const testMessages = [
        "كم سعر النظام المحاسبي؟",
        "هلا والله شلونك",
        "عندي استفسار عن باقة الواتساب",
        "😂❤️",
        "بدي اعرف عرض السوفت"
    ];
    
    let results = "🧪 نتائج اختبار التصفية:\n\n";
    
    testMessages.forEach(message => {
        const isBusiness = smartFilter.isBusinessRelated(message);
        const isPersonal = smartFilter.isPersonalMessage(message);
        const hasExcluded = smartFilter.containsExcludedKeywords(message);
        
        let decision = "❌ مرفوض";
        if (isBusiness && !isPersonal && !hasExcluded) {
            decision = "✅ مقبول";
        }
        
        results += `${decision} - "${message}"\n`;
        results += `   📊 عمل: ${isBusiness} | شخصي: ${isPersonal} | مستبعد: ${hasExcluded}\n\n`;
    });
    
    alert(results);
}

// تحديث معلومات النظام
async function refreshSystemInfo() {
    try {
        const [sessionsRes, problemsRes, statusRes] = await Promise.all([
            fetch('/api/sessions'),
            fetch('/api/problems?status=new'),
            fetch('/api/status')
        ]);
        
        const sessions = await sessionsRes.json();
        const problems = await problemsRes.json();
        const status = await statusRes.json();
        
        document.getElementById('activeSessions').value = sessions.total || 0;
        document.getElementById('newProblems').value = problems.length || 0;
        document.getElementById('botStatus').value = status.connected ? '🟢 متصل' : '🔴 غير متصل';
        document.getElementById('lastUpdate').value = new Date().toLocaleString('ar-SA');
        
    } catch (error) {
        console.log('⚠️ خطأ في تحديث معلومات النظام');
    }
}

// تصدير البيانات
function exportData() {
    const data = {
        company: currentData.replies?.companyName,
        sessions: currentData.sessions?.total,
        problems: currentData.problems?.length,
        settings: currentData.settings,
        timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `bot-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}
// القوائم الثابتة
function getPricingMenu() {
    return `💎 *باقاتنا وخدماتنا* ✨

*الباقات الشهرية:*

🤖 *باقة واتساب الذكية* - ١٠ دولار/شهر
• نظام ردود تلقائية ذكي
• قوائم متعددة المستويات
• دعم فني متكامل
• تحديثات مستمرة
• تقارير أداء

📱 *باقة SMS الترويجية* 
• *السنة الأولى:* ١٠٠ دولار/سنة
• *السنة الثانية فما فوق:* ٥٠ دولار/سنة
• رسائل SMS جماعية
• إدارة جهات اتصال
• تقارير تفصيلية
• دعم تقني متكامل

*الخدمات المميزة:*

🎯 *أنظمة محاسبية متكاملة*
• نظام فواتير إلكترونية
• إدارة مخزون ذكية
• تقارير مالية مفصلة

🏦 *أنظمة شركات الصرافة*
• إدارة عملات متعددة
• تقارير البنك المركزي
• أنظمة أمنية متقدمة

🎨 *خدمات تصميم متكاملة*
• هويات بصرية
• شعارات احترافية
• مواد تسويقية

💼 *حلول مخصصة*
• أنظمة حسب الطلب
• تكامل مع أنظمة موجودة
• تطوير خاص باحتياجاتك

📞 *للاستفسار والطلب:* ${customReplies.contactInfo}

✨ *خصم ٢٠٪ للعملاء الجدد عند الاشتراك في أكثر من باقة*`;
}
function getContactMenu() {
    return `📞 *التواصل مع المبيعات*

${customReplies.contactInfo}

⏰ *أوقات العمل:*
السبت - الخميس: ٨:٣٠ ص - ٨:٣٠ م

📧 *البريد الإلكتروني:*
ebs@company.com

🌐 *الموقع:*
www.company.com`;
}

// مسارات API الجديدة
app.get('/api/problems', (req, res) => {
    const { status } = req.query;
    const problems = status ? 
        problemManager.getProblemsByStatus(status) : 
        problemManager.problems;
    res.json(problems);
});

app.post('/api/problems/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    problemManager.updateStatus(id, status);
    res.json({ success: true });
});

app.post('/api/problems/:id/message', (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    problemManager.addMessage(id, message, false);
    res.json({ success: true });
});

app.get('/api/sessions', (req, res) => {
    res.json({
        total: sessionManager.sessions.size,
        sessions: Array.from(sessionManager.sessions.entries())
    });
});

// تحديث مسار حفظ الردود ليدعم الصور والروابط
app.post('/api/replies', (req, res) => {
    try {
        // دمج البيانات الجديدة مع الحفاظ على الهيكل
        const newData = req.body;
        
        if (newData.systemDetails) {
            customReplies.systemDetails = { ...customReplies.systemDetails, ...newData.systemDetails };
        }
        if (newData.menus) {
            customReplies.menus = { ...customReplies.menus, ...newData.menus };
        }
        if (newData.problemsConfig) {
            customReplies.problemsConfig = { ...customReplies.problemsConfig, ...newData.problemsConfig };
        }
        
        Object.assign(customReplies, newData);
        saveData();
        res.json({ success: true, message: 'تم حفظ الردود بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// باقي مسارات API كما هي...
app.get('/api/replies', (req, res) => res.json(customReplies));
app.get('/api/settings', (req, res) => res.json(settings));
app.post('/api/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    saveData();
    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
});
app.get('/api/status', (req, res) => res.json({
    connected: botState.isConnected,
    qrCode: botState.qrCode,
    sessions: sessionManager.sessions.size,
    problems: problemManager.problems.length
}));
app.post('/api/toggle-reply', (req, res) => {
    settings.autoReply = !settings.autoReply;
    saveData();
    res.json({ autoReply: settings.autoReply });
});

// مسارات API للإعدادات المتقدمة
app.get('/api/advanced-settings', (req, res) => {
    res.json(settings.advancedFilters);
});

// مسارات API للإعدادات المتقدمة
app.post('/api/advanced-settings', (req, res) => {
    try {
        console.log('📥 بيانات الواردة للإعدادات المتقدمة:', req.body);
        
        if (!req.body) {
            return res.status(400).json({ error: 'لا توجد بيانات' });
        }
        
        // تأكد من وجود advancedFilters
        if (!settings.advancedFilters) {
            settings.advancedFilters = {};
        }
        
        // دمج البيانات الجديدة مع الحفاظ على القيم القديمة
        settings.advancedFilters = { 
            ...settings.advancedFilters, 
            ...req.body 
        };
        
        console.log('🔄 الإعدادات بعد الدمج:', settings.advancedFilters);
        
        // حفظ البيانات
        saveData();
        
        console.log('✅ تم حفظ الإعدادات المتقدمة بنجاح');
        res.json({ 
            success: true, 
            message: 'تم حفظ الإعدادات المتقدمة بنجاح',
            data: settings.advancedFilters 
        });
        
    } catch (error) {
        console.error('❌ خطأ في حفظ الإعدادات المتقدمة:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// مسار لإحصائيات التصفية
app.get('/api/filter-stats', (req, res) => {
    res.json({
        knownContacts: smartFilter.knownContacts.size,
        filters: settings.advancedFilters
    });
});
// واجهة المستخدم المحسنة الكاملة
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>نظام تحكم البوت المتطور - ${customReplies.companyName}</title>
        <style>
            :root { 
                --primary-color: ${settings.themeColor};
                --secondary-color: #128C7E;
            }
            * { 
                margin: 0; 
                padding: 0; 
                box-sizing: border-box; 
            }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
                min-height: 100vh;
            }
            .container { 
                max-width: 1400px; 
                margin: 0 auto; 
                padding: 0 15px; /* مسافة داخل الكونتينر */
                background: rgba(255, 255, 255, 0.95);
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header { 
                background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                padding: 30px; 
                text-align: center; 
                color: white;
                margin-bottom: 20px; /* إضافة مسافة من الأسفل */
        
            }
            .header h1 {
                font-size: 2.5em;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .header p {
                font-size: 1.2em;
                opacity: 0.9;
            }
            .tabs { 
                display: flex; 
                background: white; 
                border-bottom: 2px solid #eee;
                overflow-x: auto;
                padding: 0 20px;
            }
            .tab { 
                padding: 20px 25px; 
                cursor: pointer; 
                border-bottom: 3px solid transparent; 
                white-space: nowrap;
                font-weight: 600;
                transition: all 0.3s ease;
                color: #666;
            }
            .tab:hover {
                background: #f8f9fa;
                color: var(--primary-color);
            }
            .tab.active { 
                border-bottom-color: var(--primary-color); 
                color: var(--primary-color); 
                background: #f8f9fa;
            }
            .tab-content { 
                display: none; 
                padding: 30px; 
                min-height: 500px;
            }
            .tab-content.active { 
                display: block; 
                animation: fadeIn 0.5s ease;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .stats { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
                gap: 20px; 
                margin-bottom: 30px; 
            }
            .stat-card { 
                background: white;
                padding: 25px; 
                border-radius: 15px; 
                text-align: center; 
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                border-left: 5px solid var(--primary-color);
                transition: transform 0.3s ease;
            }
            .stat-card:hover {
                transform: translateY(-5px);
            }
            .stat-number { 
                font-size: 2.5em; 
                font-weight: bold; 
                color: var(--primary-color); 
                margin-bottom: 10px;
            }
            .problem-item { 
                border: 1px solid #e0e0e0; 
                padding: 20px; 
                margin: 15px 0; 
                border-radius: 12px;
                background: white;
                box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                transition: all 0.3s ease;
            }
            .problem-item:hover {
                box-shadow: 0 5px 20px rgba(0,0,0,0.15);
                transform: translateY(-2px);
            }
            .problem-new { border-right: 5px solid #ff4444; }
            .problem-pending { border-right: 5px solid #ffaa00; }
            .problem-resolved { border-right: 5px solid #00aa00; }
            
            .form-group { 
                margin-bottom: 20px; 
            }
            label { 
                display: block; 
                margin-bottom: 8px; 
                font-weight: 600;
                color: #333;
            }
            input, textarea, select { 
                width: 100%; 
                padding: 12px 15px; 
                border: 2px solid #e0e0e0; 
                border-radius: 10px; 
                font-size: 16px;
                transition: border-color 0.3s ease;
            }
            input:focus, textarea:focus, select:focus {
                border-color: var(--primary-color);
                outline: none;
                box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
            }
            textarea { 
                height: 120px; 
                resize: vertical; 
            }
            button { 
                background: var(--primary-color); 
                color: white; 
                border: none; 
                padding: 12px 25px; 
                border-radius: 10px; 
                cursor: pointer; 
                margin: 5px; 
                font-size: 16px;
                font-weight: 600;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
            }
            button:hover { 
                background: var(--secondary-color);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4);
            }
            .qr-container { 
                text-align: center; 
                padding: 30px; 
            }
            .qr-code img { 
                max-width: 300px; 
                border: 2px solid #ddd; 
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .status { 
                padding: 15px; 
                border-radius: 10px; 
                text-align: center; 
                margin: 15px 0; 
                font-weight: 600;
                font-size: 1.1em;
            }
            .status.connected { 
                background: #d4edda; 
                color: #155724; 
                border: 2px solid #c3e6cb;
            }
            .status.disconnected { 
                background: #f8d7da; 
                color: #721c24; 
                border: 2px solid #f5c6cb;
            }
            
            .editor-grid { 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                gap: 30px; 
            }
            .system-editor { 
                background: #f8f9fa; 
                padding: 20px; 
                border-radius: 12px; 
                margin-bottom: 20px;
                border: 1px solid #e9ecef;
            }
            .preview-container { 
                background: #e5ddd5; 
                padding: 20px; 
                border-radius: 15px; 
                margin-top: 20px;
                border: 2px solid #ddd;
            }
            .message { 
                background: white; 
                padding: 15px; 
                border-radius: 12px; 
                margin: 12px 0; 
                max-width: 85%;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .message.outgoing { 
                background: #dcf8c6; 
                margin-left: auto;
                border-bottom-right-radius: 5px;
            }
            .message.incoming {
                border-bottom-left-radius: 5px;
            }
            
            @media (max-width: 768px) { 
                .editor-grid { grid-template-columns: 1fr; } 
                .tab { padding: 15px 20px; }
                .header h1 { font-size: 2em; }
                .stat-card { padding: 20px; }
            }
            
            .tab-section {
                margin-bottom: 30px;
                padding: 25px;
                background: white;
                border-radius: 15px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            }
            .tab-section h3 {
                color: var(--primary-color);
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #f0f0f0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 نظام تحكم البوت المتطور</h1>
                <p>${customReplies.companyName} - إدارة ذكية للردود والمشاكل والجلسات</p>
            </div>

            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number" id="sessionsCount">0</div>
                    <div>📱 جلسة نشطة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="problemsCount">0</div>
                    <div>🚨 مشكلة جديدة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="systemsCount">${Object.keys(customReplies.systemDetails).length}</div>
                    <div>💼 نظام متاح</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" >📶 حالة الاتصال</div>
                    <div>📶</div>
                </div>
            </div>

            <div class="tabs">
                <div class="tab active" onclick="showTab('editor')">✏️ محرر الردود</div>
                <div class="tab" onclick="showTab('problems')">🚨 إدارة المشاكل</div>
                <div class="tab" onclick="showTab('sessions')">👥 الجلسات النشطة</div>
                <div class="tab" onclick="showTab('preview')">📱 معاينة المحادثة</div>
                <div class="tab" onclick="showTab('connection')">📲 ربط واتساب</div>
                <div class="tab" onclick="showTab('settings')">⚙️ الإعدادات المتقدمة</div>
            </div>

            <!-- محرر الردود -->
            <div id="editorTab" class="tab-content active">
                <div class="tab-section">
                    <h3>🏢 الإعدادات الأساسية</h3>
                    <div class="editor-grid">
                        <div>
                            <div class="form-group">
                                <label>اسم الشركة:</label>
                                <input type="text" id="companyName" value="${customReplies.companyName}">
                            </div>
                            <div class="form-group">
                                <label>رسالة الترحيب:</label>
                                <textarea id="welcomeMessage">${customReplies.welcomeMessage}</textarea>
                            </div>
                            <div class="form-group">
                                <label>معلومات التواصل:</label>
                                <textarea id="contactInfo">${customReplies.contactInfo}</textarea>
                            </div>
                        </div>
                        <div>
                            <div class="form-group">
                                <label>معرف مجموعة المشاكل:</label>
                                <input type="text" id="problemsGroupId" value="${customReplies.problemsConfig.groupId}" placeholder="123456789@g.us">
                            </div>
                            <div class="form-group">
                                <label>المشرفين (مفصولة بفاصلة):</label>
                                <textarea id="problemsAdmins" placeholder="123456789@c.us,987654321@c.us">${customReplies.problemsConfig.admins.join(', ')}</textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="tab-section">
                    <h3>📋 القوائم الرئيسية</h3>
                    <div class="editor-grid">
                        <div class="form-group">
                            <label>القائمة الرئيسية:</label>
                            <textarea id="mainMenu">${customReplies.menus.main}</textarea>
                        </div>
                        <div class="form-group">
                            <label>قائمة الأنظمة المحاسبية:</label>
                            <textarea id="accountingMenu">${customReplies.menus.accounting}</textarea>
                        </div>
                        <div class="form-group">
                            <label>قائمة أنظمة الصرافة:</label>
                            <textarea id="exchangeMenu">${customReplies.menus.exchange}</textarea>
                        </div>
                        <div class="form-group">
                            <label>قائمة خدمات التصميم:</label>
                            <textarea id="designMenu">${customReplies.menus.design}</textarea>
                        </div>
                    </div>
                </div>

                <div class="tab-section">
                    <h3>💼 تفاصيل الأنظمة</h3>
                    <div class="editor-grid">
                        <div>
                            <h4>📊 الأنظمة المحاسبية</h4>
                            ${Object.keys(customReplies.systemDetails).filter(key => key.startsWith('accounting')).map(key => {
                                const system = customReplies.systemDetails[key];
                                return `
                                <div class="system-editor">
                                    <div class="form-group">
                                        <label>${system.title}:</label>
                                        <textarea id="system_${key}">${system.description}</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>رابط الصورة (اختياري):</label>
                                        <input type="text" id="image_${key}" value="${system.image || ''}" placeholder="https://example.com/image.jpg">
                                    </div>
                                    <div class="form-group">
                                        <label>رابط إضافي (اختياري):</label>
                                        <input type="text" id="link_${key}" value="${system.link || ''}" placeholder="https://example.com">
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        <div>
                            <h4>💱 أنظمة الصرافة</h4>
                            ${Object.keys(customReplies.systemDetails).filter(key => key.startsWith('exchange')).map(key => {
                                const system = customReplies.systemDetails[key];
                                return `
                                <div class="system-editor">
                                    <div class="form-group">
                                        <label>${system.title}:</label>
                                        <textarea id="system_${key}">${system.description}</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>رابط الصورة (اختياري):</label>
                                        <input type="text" id="image_${key}" value="${system.image || ''}" placeholder="https://example.com/image.jpg">
                                    </div>
                                    <div class="form-group">
                                        <label>رابط إضافي (اختياري):</label>
                                        <input type="text" id="link_${key}" value="${system.link || ''}" placeholder="https://example.com">
                                    </div>
                                </div>
                                `;
                            }).join('')}
                            
                            <h4>🎨 خدمات التصميم</h4>
                            ${Object.keys(customReplies.systemDetails).filter(key => key.startsWith('design')).map(key => {
                                const system = customReplies.systemDetails[key];
                                return `
                                <div class="system-editor">
                                    <div class="form-group">
                                        <label>${system.title}:</label>
                                        <textarea id="system_${key}">${system.description}</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>رابط الصورة (اختياري):</label>
                                        <input type="text" id="image_${key}" value="${system.image || ''}" placeholder="https://example.com/image.jpg">
                                    </div>
                                    <div class="form-group">
                                        <label>رابط إضافي (اختياري):</label>
                                        <input type="text" id="link_${key}" value="${system.link || ''}" placeholder="https://example.com">
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="saveAllReplies()" style="padding: 15px 30px; font-size: 18px;">💾 حفظ كل الردود والإعدادات</button>
                </div>
            </div>

            <!-- إدارة المشاكل -->
            <div id="problemsTab" class="tab-content">
                <div class="tab-section">
                    <h3>🚨 المشاكل الجديدة</h3>
                    <div id="newProblemsList"></div>
                </div>
                <div class="tab-section">
                    <h3>⏳ المشاكل قيد المعالجة</h3>
                    <div id="pendingProblemsList"></div>
                </div>
                <div class="tab-section">
                    <h3>✅ المشاكل المكتملة</h3>
                    <div id="resolvedProblemsList"></div>
                </div>
            </div>

            <!-- الجلسات النشطة -->
            <div id="sessionsTab" class="tab-content">
                <div class="tab-section">
                    <h3>👥 الجلسات النشطة</h3>
                    <div id="sessionsList"></div>
                </div>
            </div>

            <!-- معاينة المحادثة -->
            <div id="previewTab" class="tab-content">
                <div class="tab-section">
                    <h3>📱 معاينة المحادثة</h3>
                    <div class="preview-container">
                        <div class="message incoming">
                            <strong>👤 العميل:</strong> مرحبا
                        </div>
                        <div class="message outgoing" id="previewWelcome"></div>
                        
                        <div class="message incoming">
                            <strong>👤 العميل:</strong> 1
                        </div>
                        <div class="message outgoing" id="previewAccountingMenu"></div>
                        
                        <div class="message incoming">
                            <strong>👤 العميل:</strong> 1
                        </div>
                        <div class="message outgoing" id="previewSystemDetail"></div>
                        
                        <div class="message incoming">
                            <strong>👤 العميل:</strong> 6
                        </div>
                        <div class="message outgoing" id="previewProblemReport"></div>
                    </div>
                    <button onclick="updatePreview()">🔄 تحديث المعاينة</button>
                </div>
            </div>

            <!-- ربط واتساب -->
            <div id="connectionTab" class="tab-content">
                <div class="tab-section">
                    <div class="qr-container">
                        <h3>📲 ربط واتساب</h3>
                        <div id="qrCode" class="qr-code"></div>
                        <div id="connectionStatus" class="status disconnected">
                            جاري التحميل...
                        </div>
                        <div style="margin-top: 20px;">
                            <button onclick="checkStatus()">🔄 تحديث الحالة</button>
                            <button onclick="toggleAutoReply()" id="autoReplyBtn">⏸️ إيقاف الرد التلقائي</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- الإعدادات المتقدمة -->
           

<!-- الإعدادات المتقدمة -->
<div id="settingsTab" class="tab-content">
    <!-- الإعدادات الأساسية -->
    <div class="tab-section">
        <h3>⚙️ الإعدادات الأساسية</h3>
        <div class="editor-grid">
            <div>
                <div class="form-group">
                    <label>لون السمة:</label>
                    <input type="color" id="themeColor" value="${settings.themeColor}">
                </div>
                <div class="form-group">
                    <label>مدة انتهاء الجلسة (دقيقة):</label>
                    <input type="number" id="sessionTimeout" value="${settings.sessionTimeout}" min="5" max="1440">
                </div>
            </div>
            <div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="enableImages" ${settings.enableImages ? 'checked' : ''}>
                        تفعيل الصور
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="enableLinks" ${settings.enableLinks ? 'checked' : ''}>
                        تفعيل الروابط
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="autoReply" ${settings.autoReply ? 'checked' : ''}>
                        الرد التلقائي
                    </label>
                </div>
            </div>
        </div>
    </div>

    <!-- نظام التصفية الذكي -->
    <div class="tab-section">
        <h3>🎯 التصفية الذكية للمحادثات</h3>
        <div class="editor-grid">
            <div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="enableContactFilter" ${settings.advancedFilters.enableContactFilter ? 'checked' : ''}>
                        تفعيل التصفية الذكية
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="replyToUnknownNumbers" ${settings.advancedFilters.replyToUnknownNumbers ? 'checked' : ''}>
                        الرد على الأرقام المجهولة
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="replyToSavedContacts" ${settings.advancedFilters.replyToSavedContacts ? 'checked' : ''}>
                        الرد على جهات الاتصال المحفوظة
                    </label>
                </div>
            </div>
            <div>
                <div class="form-group">
                    <label>أقل طول للرسالة:</label>
                    <input type="number" id="minMessageLength" value="${settings.advancedFilters.minMessageLength}" min="1" max="100">
                </div>
                <div class="form-group">
                    <label>الكلمات المستبعدة (مفصولة بفاصلة):</label>
                    <input type="text" id="excludeKeywords" value="${settings.advancedFilters.excludeKeywords.join(', ')}" placeholder="😂, ❤️, 😍, 👍">
                </div>
            </div>
        </div>
        
        <!-- إحصائيات التصفية -->
        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-top: 15px; border-right: 4px solid var(--primary-color);">
            <h4 style="margin-bottom: 10px; color: var(--primary-color);">📊 إحصائيات التصفية</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                <div style="text-align: center; padding: 10px; background: white; border-radius: 8px;">
                    <div style="font-size: 1.8em; color: var(--primary-color); font-weight: bold;" id="knownContactsCount">0</div>
                    <div style="font-size: 0.9em; color: #666;">جهة اتصال معروفة</div>
                </div>
                <div style="text-align: center; padding: 10px; background: white; border-radius: 8px;">
                    <div style="font-size: 1.8em; color: #28a745; font-weight: bold;" id="filteredMessages">0</div>
                    <div style="font-size: 0.9em; color: #666;">رسالة تم الرد عليها</div>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <!-- في قسم الإعدادات العامة -->
<button onclick="saveSettings('general')">💾 حفظ الإعدادات العامة</button>

<!-- في قسم الإعدادات المتقدمة -->
<button onclick="saveSettings('advanced')">💾 حفظ إعدادات التصفية</button>

<!-- في أسفل الصفحة -->
<button onclick="saveSettings('all')" class="btn-save-all">💾 حفظ كل الإعدادات</button>
            <button onclick="testFilter()" style="background: #6c757d;">🧪 اختبار التصفية</button>
        </div>
    </div>

    <!-- معلومات النظام -->
    <div class="tab-section">
        <h3>📈 معلومات النظام</h3>
        <div class="editor-grid">
            <div>
                <div class="form-group">
                    <label>عدد الجلسات النشطة:</label>
                    <input type="text" id="activeSessions" value="جاري التحميل..." readonly>
                </div>
                <div class="form-group">
                    <label>عدد المشاكل الجديدة:</label>
                    <input type="text" id="newProblems" value="جاري التحميل..." readonly>
                </div>
            </div>
            <div>
                <div class="form-group">
                    <label>حالة البوت:</label>
                    <input type="text" id="botStatus" value="جاري التحميل..." readonly>
                </div>
                <div class="form-group">
                    <label>آخر تحديث:</label>
                    <input type="text" id="lastUpdate" value="${new Date().toLocaleString('ar-SA')}" readonly>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 15px;">
            <button onclick="refreshSystemInfo()" style="background: #17a2b8;">🔄 تحديث المعلومات</button>
            <button onclick="exportData()" style="background: #28a745;">📤 تصدير البيانات</button>
        </div>
    </div>
</div>
        <script>
            let currentData = {};
            let autoReplyState = ${settings.autoReply};

            // تحميل البيانات
            async function loadData() {
                try {
                    const [repliesRes, settingsRes, problemsRes, sessionsRes] = await Promise.all([
                        fetch('/api/replies'),
                        fetch('/api/settings'),
                        fetch('/api/problems'),
                        fetch('/api/sessions')
                    ]);
               
                    
                    currentData.replies = await repliesRes.json();
                    currentData.settings = await settingsRes.json();
                    currentData.problems = await problemsRes.json();
                    currentData.sessions = await sessionsRes.json();
                    
                    updateStats();
                    updatePreview();
                    updateProblemsList();
                    updateSessionsList();
                    try {
                        await loadFilterStats();
                        await refreshSystemInfo();
                    } catch (filterError) {
                        console.log('⚠️ خطأ في البيانات الإضافية (غير حرج):', filterError);
                  }
                } catch (error) {
                    console.log('خطأ في التحميل:', error);
                }
            }

            // تبديل التبويبات
            function showTab(tabName) {
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                document.getElementById(tabName + 'Tab').classList.add('active');
                event.currentTarget.classList.add('active');
                
                if (tabName === 'preview') updatePreview();
                if (tabName === 'problems') updateProblemsList();
                if (tabName === 'sessions') updateSessionsList();
                if (tabName === 'connection') checkStatus();
            }

            // تحديث الإحصائيات
            function updateStats() {
                document.getElementById('sessionsCount').textContent = currentData.sessions?.total || 0;
                document.getElementById('problemsCount').textContent = currentData.problems?.filter(p => p.status === 'new').length || 0;
                document.getElementById('systemsCount').textContent = Object.keys(currentData.replies?.systemDetails || {}).length;
                
                const statusEl = document.getElementById('connectedStatus');
                if (currentData.settings?.connected) {
                    statusEl.textContent = '✅ متصل بـ واتساب';
                    statusEl.className = 'status connected';
                } else {
                    statusEl.textContent = '❌ غير متصل';
                    statusEl.className = 'status disconnected';
                }
            }

            // حفظ جميع الردود
            async function saveAllReplies() {
                const replies = {
                    companyName: document.getElementById('companyName').value,
                    welcomeMessage: document.getElementById('welcomeMessage').value,
                    contactInfo: document.getElementById('contactInfo').value,
                    menus: {
                        main: document.getElementById('mainMenu').value,
                        accounting: document.getElementById('accountingMenu').value,
                        exchange: document.getElementById('exchangeMenu').value,
                        design: document.getElementById('designMenu').value
                    },
                    problemsConfig: {
                        groupId: document.getElementById('problemsGroupId').value,
                        admins: document.getElementById('problemsAdmins').value.split(',').map(a => a.trim()).filter(a => a),
                        autoForward: true,
                        notifyAdmins: true
                    },
                    systemDetails: {}
                };

                // جمع تفاصيل الأنظمة
                document.querySelectorAll('[id^="system_"]').forEach(textarea => {
                    const id = textarea.id.replace('system_', '');
                    const imageEl = document.getElementById('image_' + id);
                    const linkEl = document.getElementById('link_' + id);
                    
                    replies.systemDetails[id] = {
                        title: textarea.previousElementSibling?.textContent || 'النظام',
                        description: textarea.value,
                        image: imageEl ? imageEl.value : '',
                        link: linkEl ? linkEl.value : ''
                    };
                });

                try {
                    const response = await fetch('/api/replies', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(replies)
                    });
                    const result = await response.json();
                    alert(result.success ? '✅ تم حفظ جميع الردود' : '❌ خطأ: ' + result.error);
                    loadData();
                } catch (error) {
                    alert('❌ خطأ في الاتصال');
                }
            }

            // حفظ الإعدادات
          async function saveSettings() {
    try {
        // 1. جمع الإعدادات العامة
        const generalSettings = {
            themeColor: document.getElementById('themeColor').value,
            sessionTimeout: parseInt(document.getElementById('sessionTimeout').value),
            enableImages: document.getElementById('enableImages').checked,
            enableLinks: document.getElementById('enableLinks').checked,
            autoReply: document.getElementById('autoReply').checked
        };

        // 2. جمع الإعدادات المتقدمة
        const advancedSettings = {
            enableContactFilter: document.getElementById('enableContactFilter').checked,
            replyToUnknownNumbers: document.getElementById('replyToUnknownNumbers').checked,
            replyToSavedContacts: document.getElementById('replyToSavedContacts').checked,
            minMessageLength: parseInt(document.getElementById('minMessageLength').value) || 3,
            excludeKeywords: document.getElementById('excludeKeywords').value
                .split(',')
                .map(k => k.trim())
                .filter(k => k),
            businessHours: window.settings?.advancedFilters?.businessHours || {
                enabled: false,
                start: "09:00",
                end: "17:00",
                timezone: "Asia/Riyadh"
            }
        };

        console.log('📤 الإعدادات العامة:', generalSettings);
        console.log('📤 الإعدادات المتقدمة:', advancedSettings);

        // 3. حفظ الإعدادات العامة
        const generalResponse = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(generalSettings)
        });

        const generalResult = await generalResponse.json();
        
        if (!generalResult.success) {
            throw new Error('فشل حفظ الإعدادات العامة: ' + generalResult.error);
        }

        // 4. حفظ الإعدادات المتقدمة
        const advancedResponse = await fetch('/api/advanced-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(advancedSettings)
        });

        const advancedResult = await advancedResponse.json();
        
        if (!advancedResult.success) {
            throw new Error('فشل حفظ الإعدادات المتقدمة: ' + advancedResult.error);
        }

        // 5. النجاح - رسالة واحدة فقط
        alert('✅ تم حفظ جميع الإعدادات بنجاح');
        
        // 6. إعادة تحميل البيانات والصفحة
        setTimeout(() => {
            loadData();
            loadFilterStats();
            location.reload(); // هنا بعد كل شيء
        }, 1000);

    } catch (error) {
        console.error('❌ خطأ في الحفظ:', error);
        alert('❌ خطأ في الحفظ: ' + error.message);
    }
}
               

            // تحديث المعاينة
            function updatePreview() {
                const replies = currentData.replies || {};
                
                document.getElementById('previewWelcome').textContent = 
                    replies.welcomeMessage || 'مرحباً بك!';
                
                document.getElementById('previewAccountingMenu').textContent = 
                    (replies.menus?.accounting || '').substring(0, 100) + '...';
                
                const firstSystem = replies.systemDetails?.['accounting.1'];
                document.getElementById('previewSystemDetail').textContent = 
                    firstSystem?.description?.substring(0, 150) + '...' || 'تفاصيل النظام المحاسبي...';
                
                document.getElementById('previewProblemReport').textContent = 
                    '📝 الإبلاغ عن مشكلة - الرجاء اختيار نوع المشكلة...';
            }

            // تحديث قائمة المشاكل
            function updateProblemsList() {
                const problems = currentData.problems || [];
                
                const newProblems = problems.filter(p => p.status === 'new');
                const pendingProblems = problems.filter(p => p.status === 'pending');
                const resolvedProblems = problems.filter(p => p.status === 'resolved');
                
                document.getElementById('newProblemsList').innerHTML = newProblems.map(problem => 
                    renderProblemItem(problem)
                ).join('') || '<p>لا توجد مشاكل جديدة</p>';
                
                document.getElementById('pendingProblemsList').innerHTML = pendingProblems.map(problem => 
                    renderProblemItem(problem)
                ).join('') || '<p>لا توجد مشاكل قيد المعالجة</p>';
                
                document.getElementById('resolvedProblemsList').innerHTML = resolvedProblems.map(problem => 
                    renderProblemItem(problem)
                ).join('') || '<p>لا توجد مشاكل مكتملة</p>';
            }

            // عرض عنصر المشكلة
            function renderProblemItem(problem) {
                return \`
                <div class="problem-item problem-\${problem.status}">
                    <h4>#\${problem.id.substring(0, 8)} - \${problem.category}</h4>
                    <p><strong>👤 العميل:</strong> \${problem.userName} (\${problem.userId})</p>
                    <p><strong>📝 الوصف:</strong> \${problem.problem}</p>
                    <p><strong>⏰ الوقت:</strong> \${new Date(problem.timestamp).toLocaleString('ar-SA')}</p>
                    <div style="margin-top: 10px;">
                        <button onclick="updateProblemStatus('\${problem.id}', 'pending')">🔄 قيد المعالجة</button>
                        <button onclick="updateProblemStatus('\${problem.id}', 'resolved')">✅ تم الحل</button>
                        <button onclick="sendMessageToProblem('\${problem.id}')">📨 رد</button>
                    </div>
                </div>
                \`;
            }

            // تحديث حالة المشكلة
            async function updateProblemStatus(problemId, status) {
                try {
                    const response = await fetch(\`/api/problems/\${problemId}/status\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status })
                    });
                    const result = await response.json();
                    if (result.success) {
                        loadData();
                    }
                } catch (error) {
                    alert('❌ خطأ في تحديث الحالة');
                }
            }

            // إرسال رسالة للمشكلة
            async function sendMessageToProblem(problemId) {
                const message = prompt('أدخل الرسالة:');
                if (message) {
                    try {
                        const response = await fetch(\`/api/problems/\${problemId}/message\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message })
                        });
                        const result = await response.json();
                        if (result.success) {
                            alert('✅ تم إرسال الرسالة');
                        }
                    } catch (error) {
                        alert('❌ خطأ في إرسال الرسالة');
                    }
                }
            }

            // تحديث قائمة الجلسات
            function updateSessionsList() {
                const sessions = currentData.sessions?.sessions || [];
                document.getElementById('sessionsList').innerHTML = sessions.map(([userId, session]) => \`
                    <div class="problem-item">
                        <h4>👤 \${session.userId}</h4>
                        <p><strong>📊 القائمة الحالية:</strong> \${session.currentMenu}</p>
                        <p><strong>⏱️ آخر نشاط:</strong> \${new Date(session.lastActivity).toLocaleString('ar-SA')}</p>
                        <p><strong>📈 التاريخ:</strong> \${session.history.join(' → ')}</p>
                    </div>
                \`).join('') || '<p>لا توجد جلسات نشطة</p>';
            }

            // التحقق من حالة الاتصال
            async function checkStatus() {
                try {
                    const response = await fetch('/api/status');
                    const status = await response.json();
                    
                    const statusEl = document.getElementById('connectionStatus');
                    const qrEl = document.getElementById('qrCode');
                    
                    if (status.connected) {
                        statusEl.className = 'status connected';
                        statusEl.textContent = '✅ متصل بـ واتساب';
                        qrEl.innerHTML = '<p>✅ البوت يعمل بشكل طبيعي</p>';
                    } else if (status.qrCode) {
                        statusEl.className = 'status disconnected';
                        statusEl.textContent = '📱 امسح QR Code لربط واتساب';
                        qrEl.innerHTML = '<img src="' + status.qrCode + '" alt="QR Code">';
                    } else {
                        statusEl.className = 'status disconnected';
                        statusEl.textContent = '❌ جاري التهيئة...';
                        qrEl.innerHTML = '<p>⏳ جاري التحضير...</p>';
                    }
                    
                    updateStats();
                } catch (error) {
                    console.error('خطأ:', error);
                }
            }

            // تبديل الرد التلقائي
            async function toggleAutoReply() {
                try {
                    const response = await fetch('/api/toggle-reply', { method: 'POST' });
                    const result = await response.json();
                    autoReplyState = result.autoReply;
                    document.getElementById('autoReplyBtn').textContent = 
                        autoReplyState ? '⏸️ إيقاف الرد التلقائي' : '▶️ تفعيل الرد التلقائي';
                } catch (error) {
                    alert('❌ خطأ في تبديل الرد التلقائي');
                }
            }

            // التحميل الأولي
            document.addEventListener('DOMContentLoaded', function() {
                loadData();
                setInterval(loadData, 10000); // تحديث كل 10 ثواني
                setInterval(checkStatus, 5000); // تحديث الحالة كل 5 ثواني
            });
        </script>
        <!-- التذييل -->
           <!-- تذييل أنيق -->
        <footer style="
            background: linear-gradient(135deg, #25D366, #128C7E);
            color: white;
            text-align: center;
            padding: 30px 20px;
            margin-top: 40px;
        ">
            <div style="max-width: 800px; margin: 0 auto;">
                <div style="background: rgba(255,255,255,0.15); padding: 20px; border-radius: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 1.3em;">🚀 نظام البوت الذكي</h4>
                    <p style="margin: 0; font-size: 1.1em; font-weight: 600;">
                        تم التطوير والبرمجة بواسطة 
                        <span style="color: #FFD700; text-shadow: 0 0 15px rgba(255,215,0,0.7);">
                            فرع محافظة أب
                        </span>
                    </p>
                    <p style="margin: 8px 0 0 0; opacity: 0.9;">
                        🏢 أبداع سوفت للأنظمة المحدودة
                    </p>
                </div>
                
                <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin: 20px 0;">
                    <div style="text-align: center;">
                        <div style="font-size: 2em;">📞</div>
                        <div>775513338</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2em;">🌐</div>
                        <div>www.ibdaasoft.com</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2em;">📧</div>
                        <div>info@ibdaasoft.com</div>
                    </div>
                </div>
                
                <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3);">
                    <p style="margin: 0; font-size: 0.9em; opacity: 0.8;">
                        © 2024 جميع الحقوق محفوظة. 
                        <span style="color: #FFD700;">تم التطوير في فرع محافظة أب ✨</span>
                    </p>
                </div>
            </div>
        </footer>


    </body>
    </html>
    `);
});

// تشغيل البوت مع إدارة الجلسات


// التحقق من النظام
console.log('System info:', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    puppeteerExecutable: process.env.PUPPETEER_EXECUTABLE_PATH,
    chromiumPath: process.env.CHROMIUM_PATH
});

// تهيئة إعدادات Puppeteer المتوافقة مع Render
async function getPuppeteerConfig() {
    let executablePath;
    
    // المحاولة مع @sparticuz/chromium أولاً
    try {
        const chromium = require('@sparticuz/chromium');
        executablePath = await chromium.executablePath();
        console.log('✅ Using @sparticuz/chromium path:', executablePath);
    } catch (error) {
        console.log('⚠️ @sparticuz/chromium not available, trying alternatives');
        
        // البحث عن chromium في المسارات الشائعة
        const possiblePaths = [
            process.env.PUPPETEER_EXECUTABLE_PATH,
            process.env.CHROMIUM_PATH,
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            './node_modules/puppeteer/.local-chromium/**/chrome-linux/chrome'
        ].filter(Boolean);
        
        for (const path of possiblePaths) {
            if (fs.existsSync(path)) {
                executablePath = path;
                console.log('✅ Found Chrome at:', path);
                break;
            }
        }
    }
    
    return {
        headless: 'new',
        executablePath: executablePath || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-web-security',
            '--disable-features=site-per-process'
        ],
        userDataDir: './user_data',
        timeout: 60000
    };
}

// تحديث دالة initializeBot
async function initializeBot() {
    try {
        console.log('🔄 Initializing bot with Render-compatible settings...');
        
        const puppeteerConfig = await getPuppeteerConfig();
        console.log('📋 Puppeteer config:', JSON.stringify(puppeteerConfig, null, 2));
        
        wppconnect.create({
            session: 'EnhancedMultiLevelBot',
            puppeteerOptions: puppeteerConfig,
            catchQR: (base64Qr) => {
                console.log('✅ QR Code جاهز');
                botState.qrCode = base64Qr;
                saveQRCode(base64Qr); // حفظ QR للعرض في الواجهة
            },
            logQR: false,
            disableWelcome: true
        })
        .then(client => {
            console.log('✅ البوت المتطور جاهز للعمل!');
            botState.client = client;
            botState.isConnected = true;
            
            // تنظيف الجلسات المنتهية
            setInterval(() => sessionManager.cleanupExpiredSessions(), 5 * 60 * 1000);
            
            // معالجة الرسائل
            client.onMessage(async message => {
                if (message.fromMe) return;
                
                if (!settings.autoReply) {
                    console.log('📩 رسالة (الرد التلقائي معطل):', message.body);
                    return;
                }
                
                // التصفية الذكية
                if (settings.advancedFilters && settings.advancedFilters.enableContactFilter) {
                    const shouldReply = await smartFilter.shouldReply(message, client);
                    if (!shouldReply) return;
                }
                
                try {
                    const response = await processUserInput(
                        message.from, 
                        message.notifyName || 'عميل', 
                        message.body, 
                        client
                    );
                    
                    if (response) {
                        await client.sendText(message.from, response);
                        console.log('🤖 تم الرد على:', message.from);
                        
                        if (settings.advancedFilters && settings.advancedFilters.enableContactFilter) {
                            smartFilter.addKnownContact(message.from);
                        }
                    }
                } catch (error) {
                    console.error('❌ خطأ في معالجة الرسالة:', error);
                }
            });
            
        })
        .catch(err => {
            console.error('❌ خطأ في البوت:', err);
            // إعادة المحاولة بعد تأخير
            setTimeout(initializeBot, 10000);
        });
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة البوت:', error);
    }
}



// بدء التشغيل
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 النظام المتطور يعمل على http://0.0.0.0:' + PORT);
    initializeBot();
    initializeAllSystems();
});


module.exports = {
    multiSessionManager,
    processUserInput,
    initializeAllSystems
};


























