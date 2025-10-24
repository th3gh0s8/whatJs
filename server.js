const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { Client, LocalAuth } = require('whatsapp-web.js');

const qrcode = require('qrcode');

let clientReady = false;
const messageQueue = [];

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox'],
    }
});

app.use(express.static(__dirname));

client.on('qr', (qr) => {
    io.emit('status', 'QR code received, please scan.');
    qrcode.toDataURL(qr, (err, url) => {
        io.emit('qr', url);
    });
});

client.on('auth_failure', (msg) => {
    io.emit('status', `Authentication failed: ${msg}`);
});

client.on('loading_screen', (percent, message) => {
    io.emit('status', `Loading: ${percent}% - ${message}`);
});

client.on('disconnected', (reason) => {
    io.emit('status', `Client disconnected: ${reason}`);
    clientReady = false;
});

client.on('ready', () => {
    io.emit('status', 'Client is ready!');
    console.log('Client is ready!');
    clientReady = true;
    while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        client.sendMessage(message.number, message.message);
    }
});

io.on('connection', (socket) => {
    socket.on('sendMessage', async (data) => {
        const number = `${data.number}@c.us`;
        const message = data.message;
        console.log(`Attempting to send message to ${number}: ${message}`);
        console.log(`Client ready status: ${clientReady}`);

        if (clientReady) {
            try {
                const response = await client.sendMessage(number, message);
                console.log('Message sent successfully:', response);
                io.emit('status', `Message sent to ${data.number}`);
            } catch (error) {
                console.error('Error sending message:', error);
                io.emit('status', `Error sending message to ${data.number}: ${error.message}`);
            }
        } else {
            messageQueue.push({ number, message });
            io.emit('status', 'Client not ready, message queued.');
            console.log('Client not ready, message queued.');
        }
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});

client.initialize();