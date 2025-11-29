const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send(`
        <h1>🚀 WhatsApp Bot - Under Maintenance</h1>
        <p>✅ Chrome installed: /opt/render/.cache/puppeteer/chrome/linux-121.0.6167.85/chrome-linux64/chrome</p>
        <p>⏳ Preparing full project deployment...</p>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Server running on port ' + PORT);
});
