const fs = require('fs');
const express = require('express');
const session = require('express-session');
const path = require('path');
const { WebhookClient, Client, Intents } = require('discord.js');
const bodyParser = require('body-parser');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userdata.html'));
});

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
    ],
});

app.use(session({
    secret: 'fVnor25LkdD_AQcHvs80rT0GdHAgEqvb',
    resave: false,
    saveUninitialized: false,
}));

const prefix = '-';
const dataFilePath = 'data.json';

function readData() {
    try {
        const rawData = fs.readFileSync(dataFilePath);
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading data file:', error);
        return {};
    }
}

function writeData(data) {
    try {
        const jsonData = JSON.stringify(data, null, 2);
        fs.writeFileSync(dataFilePath, jsonData);
    } catch (error) {
        console.error('Error writing data file:', error);
    }
}

function exposeScammer(user, userId, reason, photos) {
    const data = readData();
    data.scammers.push({ user, userId, reason, status: "نصاب", photos });
    writeData(data);
}

function verifyUser(username, userId, photos) {
    const data = readData();
    const alreadyVerified = data.verifiedUsers.find(verifiedUser => verifiedUser.userId === userId);
    if (alreadyVerified) {
        console.error('User already verified:', username);
        return;
    }
    data.verifiedUsers.push({ username, userId, status: "موثوق", photos });
    writeData(data);
}

function removeScammer(userId) {
    const data = readData();
    data.scammers = data.scammers.filter(scammer => scammer.userId !== userId);
    writeData(data);
}

function removeVerification(userId) {
    const data = readData();
    data.verifiedUsers = data.verifiedUsers.filter(verifiedUser => verifiedUser.userId !== userId);
    writeData(data);
}

async function sendNewScammerToWebhooks(user, userId, reason, photos) {
    try {
        const data = fs.readFileSync('data-webhooks.json');
        const webhooks = JSON.parse(data).webhooks;
        
        let photosText = 'No photos provided';
        if (photos && photos.length > 0) {
            photosText = photos.join(', ');
        }

        const message = `**نصاب جديد!**
        **User ID:** ${userId}
        **Reason:** ${reason}
        **Photos:** ${photosText}`;

        for (const webhook of webhooks) {
            const webhookClient = new WebhookClient({ url: webhook.url });
            await webhookClient.send(message);
        }
    } catch (error) {
        console.error('Error sending message to webhooks:', error);
    }
}

app.get('/userdata', (req, res) => {
    try {
        const data = readData();
        const userId = req.query.userid;
        if (!userId) {
            res.status(404).send('User ID is required.'); 
            return;
        }

        const user = data.scammers.find(scammer => scammer.userId === userId) ||
                     data.verifiedUsers.find(verifiedUser => verifiedUser.userId === userId);
        if (!user) {
            res.status(404).send('User not found.'); 
            return;
        }

        const status = (user.status === 'موثوق') ? 'موثوق' : 'نصاب';
        const reason = user.reason || 'لا يوجد سبب محدد';
        const photos = user.photos || [];
        res.send({ userId: user.userId, status: status, reason: reason, photos: photos });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Internal server error.');
    }
});

app.post('/api/expose-scammer', (req, res) => {
    const { user, userId, reason, photos } = req.body;
    exposeScammer(user, userId, reason, photos);
    sendNewScammerToWebhooks(user, userId, reason, photos);
    res.send('Scammer exposed successfully.');
});

app.post('/api/verify', (req, res) => {
    const { username, userId, photos } = req.body;
    verifyUser(username, userId, photos);
    res.send('User verified successfully.');
});

app.delete('/api/remove-scammer/:userId', (req, res) => {
    const userId = req.params.userId;
    removeScammer(userId);
    res.send('Scammer removed successfully.');
});

app.delete('/api/remove-verification/:userId', (req, res) => {
    const userId = req.params.userId;
    removeVerification(userId);
    res.send('Verification removed successfully.');
});

const webhookUrl = 'https://discord.com/api/webhooks/1209942330233192478/LpKXNsaaYx-L4O5gwSP69ke40Ew-Uzta5wGXLJ54CIWGstxDWxysU20Hst8pFQAQNp5S';

async function sendToChannel(message) {
    try {
        const webhook = new WebhookClient({ url: webhookUrl });
        await webhook.send(message);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

app.post('/api/order', (req, res) => {
    const { userId, scammerId, product, issue, photos } = req.body;
    const message = `**New Order for Exposing Scammer!**
    **Scammer ID:** ${userId}
    **Scammer's ID:** ${scammerId}
    **Product and Issue:** ${product} - ${issue}
    **Photos:** ${photos.join(', ')}`;

    sendToChannel(message);
    res.send('Order submitted successfully.');
});

app.post('/api/order-verify', (req, res) => {
    const { username, userId, product, photos } = req.body;
    const photosText = Array.isArray(photos) ? photos.join(', ') : 'No photos provided';
    const message = `**New Verification Order**
    **Username:** ${username}

    **User ID:** ${userId}

    **Product:** ${product}

    **Photos:** ${photosText}`;

    sendToChannel(message);

    res.send('Verification order submitted successfully.');

});

app.post('/api/webhook', (req, res) => {
    const { id, url } = req.body;
    try {
        const data = fs.readFileSync('data-webhooks.json');
        const webhooks = JSON.parse(data).webhooks;
        webhooks.push({ id, url });
        fs.writeFileSync('data-webhooks.json', JSON.stringify({ webhooks }, null, 2));
        res.send('Webhook added successfully.');
    } catch (error) {
        console.error('Error adding webhook:', error);
        res.status(500).send('Internal server error.');
    }
});

const listeners = app.listen(9054, function() {
    console.log("Your app is listening on port 9054");
});

client.login('MTE0NDM5NDk5OTA3MzYyNDIwNQ.GnumrM.whJ8awQzst_ggy9NNJKL_drgFYcs4wiHFsy1Eg');
