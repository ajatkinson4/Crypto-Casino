const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();

app.use(bodyParser.json({
    verify: function(req, res, buf) {
        req.rawBody = buf.toString();
    }
}));

app.post('/webhook', (req, res) => {
    const signature = req.headers['x-cc-webhook-signature'];
    const hmac = crypto.createHmac('sha256', 'fdbc5917-c45c-4174-a8e1-3a39fd7e59fc');
    const hash = hmac.update(req.rawBody).digest('hex');

    if (signature !== hash) {
        console.log('❌ Invalid signature');
        res.status(400).send('Invalid signature');
        return;
    }

    console.log('✅ Coinbase Notification');
    res.status(200).send('OK');
});

app.listen(3000, () => console.log('Server running on port 3000'));