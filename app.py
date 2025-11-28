import time
import threading
import json
import os
from datetime import datetime
from flask import Flask, render_template_string, request, jsonify
from flask_socketio import SocketIO
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import base64
import urllib.parse

# ========== إعدادات التطبيق ==========
app = Flask(__name__)
app.config['SECRET_KEY'] = 'ebssoft_secret_key_2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# ========== حالة البوت ==========
bot_state = {
    'is_connected': False,
    'auto_reply': True,
    'qr_code': None,
    'clients': {},
    'driver': None,
    'waiting_for_qr': False,
    'bot_thread': None
}

# ========== الردود التلقائية ==========
REPLIES = {
    "مرحبا": "أهلاً بك! هذا عمرو موسى حسن من إبداع سوفت، كيف يمكننا مساعدتك اليوم؟",
    "خدمات": "نحن في إبداع سوفت نقدم: أنظمة محاسبية وإدارية، تصميم مواقع، تطبيقات أندرويد، تسويق إلكتروني، SEO، رفع واستضافة مواقع، تصميم صور بالذكاء الاصطناعي.",
    "سعر": "للحصول على الأسعار التفصيلية، يمكنك طلب التفاصيل وسأرسلها لك مباشرة.",
    "شكرا": "العفو! نحن هنا لخدمتك. هل تحتاج أي مساعدة أخرى؟",
    "السلام عليكم": "وعليكم السلام ورحمة الله وبركاته! كيف يمكنني مساعدتك؟",
    "اهلا": "أهلاً وسهلاً بك! نحن هنا لخدمتك."
}

# ========== كلمات الدعم الشخصي ==========
HUMAN_SUPPORT_KEYWORDS = ["تحدث مع موظف", "مساعدة", "مطلوب دعم", "استشارة", "مدير", "مسؤول"]

# ========== واجهة الويب ==========
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بوت إبداع سوفت - لوحة التحكم</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.1/socket.io.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
        .card { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .status { padding: 15px; border-radius: 5px; margin: 10px 0; text-align: center; font-weight: bold; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .loading { background: #fff3cd; color: #856404; }
        .btn { padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin: 5px; }
        .btn-success { background: #28a745; color: white; }
        .btn-primary { background: #007bff; color: white; }
        .btn:disabled { background: #6c757d; cursor: not-allowed; }
        .qr-code { max-width: 300px; margin: 20px auto; border: 2px solid #333; padding: 10px; }
        .logs { background: #1e1e1e; color: #00ff00; padding: 15px; border-radius: 5px; height: 200px; overflow-y: auto; font-family: monospace; }
        .log-entry { margin-bottom: 5px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 بوت إبداع سوفت</h1>
            <p>نظام الرد الآلي على الواتساب</p>
        </div>
        
        <div class="card">
            <h3>📊 حالة النظام</h3>
            <div id="status" class="status disconnected">❌ البوت غير متصل</div>
            <div style="text-align: center;">
                <button id="startBtn" class="btn btn-success" onclick="startBot()">🚀 تشغيل البوت</button>
                <button id="autoReplyBtn" class="btn btn-primary" disabled onclick="toggleAutoReply()">🤖 تشغيل الرد التلقائي</button>
            </div>
        </div>

        <div class="card">
            <h3>📱 ربط الواتساب</h3>
            <div id="qrContainer">
                <p>انقر على "تشغيل البوت" لبدء الربط</p>
            </div>
        </div>

        <div class="card">
            <h3>📝 سجل الأحداث</h3>
            <div id="logs" class="logs">
                <div class="log-entry">[00:00:00] جاهز للتشغيل...</div>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        
        function startBot() {
            document.getElementById('startBtn').disabled = true;
            document.getElementById('startBtn').innerText = '⏳ جاري التشغيل...';
            document.getElementById('status').className = 'status loading';
            document.getElementById('status').innerText = '⏳ جاري التشغيل...';
            socket.emit('start_bot');
        }

        function toggleAutoReply() {
            socket.emit('toggle_auto_reply');
        }

        function addLog(message) {
            const logs = document.getElementById('logs');
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.innerHTML = `[${timestamp}] ${message}`;
            logs.appendChild(logEntry);
            logs.scrollTop = logs.scrollHeight;
        }

        socket.on('connect', () => {
            addLog('✅ متصل بالسيرفر');
        });

        socket.on('status', (data) => {
            const status = document.getElementById('status');
            const autoReplyBtn = document.getElementById('autoReplyBtn');
            const startBtn = document.getElementById('startBtn');
            
            if (data.connected) {
                status.className = 'status connected';
                status.innerText = '✅ البوت متصل';
                startBtn.style.display = 'none';
                autoReplyBtn.disabled = false;
                autoReplyBtn.innerText = data.auto_reply ? '🤖 إيقاف الرد' : '🤖 تشغيل الرد';
            } else {
                status.className = 'status disconnected';
                status.innerText = '❌ البوت غير متصل';
                autoReplyBtn.disabled = true;
            }
        });

        socket.on('qr_code', (data) => {
            document.getElementById('qrContainer').innerHTML = `
                <p><strong>مسح رمز QR:</strong></p>
                <img src="${data.qr_code}" class="qr-code" alt="QR Code">
                <p>افتح الواتساب → الإعدادات → الأجهزة المرتبطة → ربط جهاز</p>
            `;
            addLog('📱 تم إنشاء QR code');
        });

        socket.on('log', (data) => {
            addLog(data.message);
        });

        socket.on('error', (data) => {
            addLog('❌ ' + data.message);
            document.getElementById('startBtn').disabled = false;
            document.getElementById('startBtn').innerText = '🚀 تشغيل البوت';
        });
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@socketio.on('connect')
def handle_connect():
    print('👤 مستخدم متصل')
    socketio.emit('log', {'message': '✅ متصل بالسيرفر'})

@socketio.on('start_bot')
def handle_start_bot():
    print('🚀 بدء تشغيل البوت...')
    socketio.emit('log', {'message': '🚀 بدء تشغيل البوت...'})
    
    if bot_state['is_connected']:
        socketio.emit('log', {'message': '⚠️ البوت يعمل بالفعل'})
        return
    
    thread = threading.Thread(target=start_whatsapp_bot)
    thread.daemon = True
    thread.start()

@socketio.on('toggle_auto_reply')
def handle_toggle_auto_reply():
    bot_state['auto_reply'] = not bot_state['auto_reply']
    status = "مفعل" if bot_state['auto_reply'] else "معطل"
    socketio.emit('log', {'message': f'🔄 الرد التلقائي: {status}'})
    socketio.emit('status', {
        'connected': bot_state['is_connected'],
        'auto_reply': bot_state['auto_reply']
    })

def setup_driver_simple():
    """إعداد متصفح بسيط وسريع"""
    try:
        socketio.emit('log', {'message': '🔧 جاري فتح المتصفح...'})
        
        options = webdriver.ChromeOptions()
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-blink-features=AutomationControlled')
        
        # حاول استخدام Chrome العادي بدون webdriver-manager
        try:
            driver = webdriver.Chrome(options=options)
            socketio.emit('log', {'message': '✅ تم فتح المتصفح بنجاح'})
            return driver
        except Exception as e:
            socketio.emit('log', {'message': '❌ فشل فتح Chrome، جاري استخدام Firefox...'})
            # جرب Firefox كبديل
            try:
                from selenium.webdriver import Firefox
                from selenium.webdriver.firefox.options import Options
                firefox_options = Options()
                firefox_options.add_argument('--no-sandbox')
                driver = Firefox(options=firefox_options)
                socketio.emit('log', {'message': '✅ تم فتح Firefox بنجاح'})
                return driver
            except:
                socketio.emit('error', {'message': '❌ لم يتم العثور على أي متصفح. يرجى تثبيت Chrome أو Firefox'})
                return None
                
    except Exception as e:
        socketio.emit('error', {'message': f'خطأ في إعداد المتصفح: {str(e)}'})
        return None

def start_whatsapp_bot():
    """بدء بوت الواتساب"""
    driver = None
    try:
        driver = setup_driver_simple()
        if not driver:
            return
        
        bot_state['driver'] = driver
        
        socketio.emit('log', {'message': '🌐 جاري فتح الواتساب...'})
        driver.get('https://web.whatsapp.com')
        
        # انتظار ظهور QR code
        socketio.emit('log', {'message': '⏳ في انتظار QR code...'})
        wait = WebDriverWait(driver, 30)
        qr_element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "canvas")))
        
        # التقاط QR code
        qr_screenshot = qr_element.screenshot_as_png
        qr_base64 = base64.b64encode(qr_screenshot).decode()
        qr_data_url = f"data:image/png;base64,{qr_base64}"
        
        socketio.emit('qr_code', {'qr_code': qr_data_url})
        socketio.emit('log', {'message': '📱 يرجى مسح QR code'})
        
        # انتظار الاتصال
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='conversation-list']")))
        
        bot_state['is_connected'] = True
        socketio.emit('status', {
            'connected': True,
            'auto_reply': bot_state['auto_reply']
        })
        socketio.emit('log', {'message': '✅ تم الربط بنجاح!'})
        
        # البقاء نشطاً
        while bot_state['is_connected']:
            time.sleep(1)
            
    except Exception as e:
        error_msg = f"خطأ: {str(e)}"
        print(f"❌ {error_msg}")
        socketio.emit('error', {'message': error_msg})
        socketio.emit('log', {'message': f'❌ {error_msg}'})
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

if __name__ == '__main__':
    print('🚀 بدء تشغيل البوت...')
    print('🌐 افتح: http://localhost:5000')
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False)