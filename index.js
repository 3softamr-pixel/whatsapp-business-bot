const express = require('express');
const http = require('http');
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// إعداد Express
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// مجلدات البيانات
const dataDir = path.join(__dirname, 'data');
const sessionsDir = path.join(dataDir, 'sessions');
const repliesFile = path.join(dataDir, 'replies.json');
const settingsFile = path.join(dataDir, 'settings.json');
const problemsFile = path.join(dataDir, 'problems.json');

// ⭐⭐ الحل الجديد: إعدادات Puppeteer المتوافقة مع Render
const getPuppeteerConfig = () => {
    console.log('🔍 جاري اكتشاف إعدادات المتصفح...');
    
    // البحث عن المتصفحات المتاحة
    const possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/chrome',
        '/snap/bin/chromium',
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_BIN
    ];

    let executablePath = null;
    for (const path of possiblePaths) {
        if (path && fs.existsSync(path)) {
            console.log(`✅ وجدت المتصفح في: ${path}`);
            executablePath = path;
            break;
        }
    }

    // إعدادات التشغيل الأساسية
    const baseConfig = {
        headless: true,
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

    // إذا وجدنا مسار متصفح، نضيفه
    if (executablePath) {
        baseConfig.executablePath = executablePath;
        console.log(`🚀 سيتم استخدام المتصفح من: ${executablePath}`);
    } else {
        console.log('⚠️  لم أعثر على متصفح، سيحاول Puppeteer استخدام المتصفح الافتراضي');
    }

    return baseConfig;
};

// التأكد من وجود المجلدات
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

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
        }
    },

    // إعدادات المشاكل والمجموعات
    problemsConfig: {
        groupId: "",
        autoForward: true,
        notifyAdmins: true,
        admins: ["123456789@c.us"]
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
    sessionTimeout: 30,
    enableImages: true,
    enableLinks: true,
    advancedFilters: {
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
    }
};

// تحميل البيانات المحفوظة
try {
    if (fs.existsSync(repliesFile)) {
        const saved = JSON.parse(fs.readFileSync(repliesFile, 'utf8'));
        customReplies = { ...customReplies, ...saved };
    }
    if (fs.existsSync(settingsFile)) {
        const savedSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        settings = { ...settings, ...savedSettings };
        
        // التأكد من وجود advancedFilters
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
        }
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
class SmartFilter {
    constructor() {
        this.knownContacts = new Set();
        this.businessKeywords = [
            "سعر", "خدمة", "نظام", "محاسبي", "برنامج", "شركة",
            "عميل", "طلب", "عرض", "سوفت", "محاسبة", "دعم", "تكلفة"
        ];
        this.personalKeywords = [
            "هلا", "شلونك", "اخبارك", "وينك", "باي", "تصبحون",
            "صباح", "مساء", "نورت", "الله", "يسلمك", "الحمدلله"
        ];
    }

    async shouldReply(message, client) {
        const filters = settings.advancedFilters;
        if (!filters.enableContactFilter) return true;

        const from = message.from;
        const messageText = message.body || '';
        
        if (messageText.length < filters.minMessageLength) {
            console.log('🚫 تم تجاهل رسالة قصيرة:', messageText);
            return false;
        }

        if (this.containsExcludedKeywords(messageText)) {
            console.log('🚫 تم تجاهل رسالة تحتوي على رموز مستبعدة');
            return false;
        }

        const isBusinessMessage = this.isBusinessRelated(messageText);
        const isPersonalMessage = this.isPersonalMessage(messageText);

        console.log('🔍 تحليل الرسالة:', {
            نص: messageText.substring(0, 30),
            عمل: isBusinessMessage,
            شخصية: isPersonalMessage
        });

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

    isBusinessRelated(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return this.businessKeywords.some(keyword => 
            lowerText.includes(keyword.toLowerCase())
        );
    }

    isPersonalMessage(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return this.personalKeywords.some(keyword => 
            lowerText.includes(keyword.toLowerCase())
        );
    }

    containsExcludedKeywords(text) {
        if (!text) return false;
        return settings.advancedFilters.excludeKeywords.some(keyword => 
            text.includes(keyword)
        );
    }

    addKnownContact(phoneNumber) {
        this.knownContacts.add(phoneNumber);
        console.log('📝 تم إضافة الرقم لقائمة المعرفة:', phoneNumber);
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

    if (cleanText === '0' || cleanText === '٠') {
        return handleBackCommand(userId, session);
    }

    if (cleanText === '6' || cleanText === '٦') {
        return startProblemReport(userId, session);
    }

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
        
        default:
            response = processText(customReplies.menus.main, { name: userName });
            sessionManager.updateSession(userId, { currentMenu: 'main', history: ['main'] });
    }

    return response;
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
        case '6': case '٦':
            return startProblemReport(userId, session);
        default:
            response = `❌ *خيار غير صحيح*\n\n${processText(customReplies.menus.main, { name: userName })}`;
    }

    sessionManager.updateSession(userId, { currentMenu: nextMenu, history: session.history });
    return response;
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
        const problem = problemManager.addProblem(userId, userName, text, session.problemCategory);
        
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
        
        if (customReplies.problemsConfig.notifyAdmins) {
            for (let admin of customReplies.problemsConfig.admins) {
                await client.sendText(admin, `🔔 ${message}`);
            }
        }
    } catch (error) {
        console.log('⚠️ خطأ في إرسال إشعار المشكلة:', error);
    }
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

// إرسال تفاصيل النظام
async function sendSystemDetails(systemKey, userId, session, userName, client) {
    const system = customReplies.systemDetails[systemKey];
    let response = system.description;
    
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
    
    if (system.link && settings.enableLinks) {
        response += `\n\n🔗 *رابط إضافي:* ${system.link}`;
    }

    response += `\n\n📞 *للاتصال:* ${customReplies.contactInfo}\n0️⃣ رجوع للقائمة السابقة`;

    sessionManager.updateSession(userId, { 
        currentMenu: session.currentMenu,
        lastSystem: systemKey 
    });

    return processText(response, { name: userName });
}

// القوائم الثابتة
function getPricingMenu() {
    return `💎 *باقاتنا وخدماتنا* ✨

*الباقات الشهرية:*

🤖 *باقة واتساب الذكية* - ١٠ دولار/شهر
• نظام ردود تلقائية ذكي
• قوائم متعددة المستويات
• دعم فني متكامل

📱 *باقة SMS الترويجية* 
• *السنة الأولى:* ١٠٠ دولار/سنة
• *السنة الثانية فما فوق:* ٥٠ دولار/سنة
• رسائل SMS جماعية
• إدارة جهات اتصال

📞 *للاستفسار والطلب:* ${customReplies.contactInfo}`;
}

function getContactMenu() {
    return `📞 *التواصل مع المبيعات*

${customReplies.contactInfo}

⏰ *أوقات العمل:*
السبت - الخميس: ٨:٣٠ ص - ٨:٣٠ م

📧 *البريد الإلكتروني:*
ebs@company.com`;
}

// ⭐⭐ الحل الجديد: تشغيل البوت مع التعامل مع الأخطاء
function initializeBot() {
    console.log('🚀 بدء تشغيل البوت مع الإعدادات المتوافقة...');
    
    // الحصول على إعدادات المتصفح المتوافقة
    const puppeteerConfig = getPuppeteerConfig();
    
    wppconnect.create({
        session: 'EnhancedMultiLevelBot',
        puppeteerOptions: puppeteerConfig,
        catchQR: (base64Qr) => {
            console.log('✅ QR Code جاهز');
            botState.qrCode = base64Qr;
        },
        // إعدادات إضافية للاستقرار
        disableWelcome: true,
        updatesLog: false,
        logQR: false
    })
    .then(client => {
        console.log('✅ البوت المتطور جاهز للعمل!');
        botState.client = client;
        botState.isConnected = true;

        // تنظيف الجلسات المنتهية كل 5 دقائق
        setInterval(() => sessionManager.cleanupExpiredSessions(), 5 * 60 * 1000);

        client.onMessage(async message => {
            if (message.fromMe) return;
            
            if (!settings.autoReply) {
                console.log('📩 رسالة (الرد التلقائي معطل):', message.body);
                return;
            }

            // نظام التصفية الذكي
            if (settings.advancedFilters && settings.advancedFilters.enableContactFilter) {
                const shouldReply = await smartFilter.shouldReply(message, client);
                if (!shouldReply) {
                    console.log('🚫 تم تصفية الرسالة من:', message.from, '- المحتوى:', message.body?.substring(0, 50));
                    return;
                }
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
        console.error('❌ خطأ في تشغيل البوت:', err);
        console.log('🔄 إعادة المحاولة بعد 10 ثواني...');
        setTimeout(initializeBot, 10000);
    });
}

// ⭐⭐ الحل الجديد: إضافة مسارات API الأساسية
app.get('/api/replies', (req, res) => res.json(customReplies));
app.get('/api/settings', (req, res) => res.json(settings));
app.get('/api/status', (req, res) => res.json({
    connected: botState.isConnected,
    qrCode: botState.qrCode,
    sessions: sessionManager.sessions.size,
    problems: problemManager.problems.length
}));

app.post('/api/replies', (req, res) => {
    try {
        Object.assign(customReplies, req.body);
        saveData();
        res.json({ success: true, message: 'تم حفظ الردود بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        Object.assign(settings, req.body);
        saveData();
        res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/problems', (req, res) => {
    const { status } = req.query;
    const problems = status ? 
        problemManager.getProblemsByStatus(status) : 
        problemManager.problems;
    res.json(problems);
});

app.get('/api/sessions', (req, res) => {
    res.json({
        total: sessionManager.sessions.size,
        sessions: Array.from(sessionManager.sessions.entries())
    });
});

app.post('/api/toggle-reply', (req, res) => {
    settings.autoReply = !settings.autoReply;
    saveData();
    res.json({ autoReply: settings.autoReply });
});

// ⭐⭐ الحل الجديد: واجهة تحكم مبسطة
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>نظام البوت المتطور</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                background: #f0f2f5; 
                margin: 0; 
                padding: 20px; 
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .status { 
                padding: 15px; 
                border-radius: 5px; 
                margin: 10px 0; 
                text-align: center;
                font-weight: bold;
            }
            .connected { background: #d4edda; color: #155724; }
            .disconnected { background: #f8d7da; color: #721c24; }
            .qr-code { text-align: center; margin: 20px 0; }
            button { 
                background: #25D366; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 5px; 
                cursor: pointer; 
                margin: 5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 نظام البوت المتطور</h1>
            <div id="status" class="status">جاري التحميل...</div>
            <div id="qrCode" class="qr-code"></div>
            <div>
                <button onclick="checkStatus()">تحديث الحالة</button>
                <button onclick="toggleAutoReply()" id="autoReplyBtn">إيقاف الرد التلقائي</button>
            </div>
        </div>
        <script>
            async function checkStatus() {
                try {
                    const response = await fetch('/api/status');
                    const status = await response.json();
                    
                    const statusEl = document.getElementById('status');
                    const qrEl = document.getElementById('qrCode');
                    
                    if (status.connected) {
                        statusEl.className = 'status connected';
                        statusEl.textContent = '✅ البوت متصل ويعمل';
                        qrEl.innerHTML = '';
                    } else if (status.qrCode) {
                        statusEl.className = 'status disconnected';
                        statusEl.textContent = '📱 امسح QR Code لربط واتساب';
                        qrEl.innerHTML = '<img src="' + status.qrCode + '" alt="QR Code" style="max-width: 300px;">';
                    } else {
                        statusEl.className = 'status disconnected';
                        statusEl.textContent = '❌ جاري التهيئة...';
                        qrEl.innerHTML = '';
                    }
                } catch (error) {
                    console.error('خطأ:', error);
                }
            }
            
            async function toggleAutoReply() {
                try {
                    const response = await fetch('/api/toggle-reply', { method: 'POST' });
                    const result = await response.json();
                    document.getElementById('autoReplyBtn').textContent = 
                        result.autoReply ? 'إيقاف الرد التلقائي' : 'تفعيل الرد التلقائي';
                } catch (error) {
                    alert('❌ خطأ في تبديل الرد التلقائي');
                }
            }
            
            // التحميل الأولي
            checkStatus();
            setInterval(checkStatus, 5000);
        </script>
    </body>
    </html>
    `);
});

// ⭐⭐ الحل الجديد: بدء التشغيل مع التعامل مع الأخطاء
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 النظام المتطور يعمل على http://0.0.0.0:' + PORT);
    console.log('🔧 جاري تشغيل البوت مع الإعدادات المتوافقة...');
    
    // بدء تشغيل البوت بعد ثانيتين لضمان تحميل الخادم أولاً
    setTimeout(() => {
        initializeBot();
    }, 2000);
});

// التعامل مع الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
    console.error('❌ خطأ غير متوقع:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ خطأ في Promise:', reason);
});
