const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { Client, LocalAuth } = require('whatsapp-web.js');

const qrcode = require('qrcode');

const clients = new Map(); // Stores WhatsApp clients by session_id
const messageQueue = [];

function initializeWhatsAppClient(session_id) {
    console.log(`Initializing WhatsApp client for session: ${session_id}`);
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: session_id }),
        puppeteer: {
            args: ['--no-sandbox'],
        }
    });

    clients.set(session_id, { client, ready: false, messageQueue: [] });

    client.on('qr', (qr) => {
        io.emit('status', { session_id, message: 'QR code received, please scan.' });
        qrcode.toDataURL(qr, (err, url) => {
            io.emit('qr', { session_id, url });
        });
    });

    client.on('auth_failure', (msg) => {
        io.emit('status', { session_id, message: `Authentication failed: ${msg}` });
    });

    client.on('loading_screen', (percent, message) => {
        io.emit('status', { session_id, message: `Loading: ${percent}% - ${message}` });
    });

    client.on('disconnected', (reason) => {
        io.emit('status', { session_id, message: `Client disconnected: ${reason}` });
        io.emit('clearQr', session_id);
        clients.get(session_id).ready = false;
        clients.delete(session_id); // Remove client from map on disconnect
    });

    client.on('ready', () => {
        io.emit('status', { session_id, message: 'Client is ready!' });
        console.log(`Client for session ${session_id} is ready!`);
        const sessionData = clients.get(session_id);
        sessionData.ready = true;
        // Process queued messages for this session
        while (sessionData.messageQueue.length > 0) {
            const message = sessionData.messageQueue.shift();
            client.sendMessage(message.number, message.message);
        }
    });

    client.initialize();
}

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.on('createSession', (session_id) => {
        initializeWhatsAppClient(session_id);
    });

    socket.on('sendMessage', async (data) => {
        const { session_id, number, message } = data;
        const clientData = clients.get(session_id);

        if (!clientData) {
            io.emit('status', { session_id, message: 'Client not found for this session.' });
            return;
        }

        const { client, ready } = clientData;
        const formattedNumber = `${number}@c.us`;

        console.log(`Attempting to send message from session ${session_id} to ${formattedNumber}: ${message}`);
        console.log(`Client ready status for session ${session_id}: ${ready}`);

        if (ready) {
            try {
                const response = await client.sendMessage(formattedNumber, message);
                console.log('Message sent successfully:', response);
                io.emit('status', { session_id, message: `Message sent to ${number}` });
            } catch (error) {
                console.error('Error sending message:', error);
                io.emit('status', { session_id, message: `Error sending message to ${number}: ${error.message}` });
            }
        } else {
            clientData.messageQueue.push({ number: formattedNumber, message });
            io.emit('status', { session_id, message: 'Client not ready, message queued.' });
            console.log(`Client for session ${session_id} not ready, message queued.`);
        }
    });

    socket.on('disconnectClient', async (session_id) => {
        console.log(`Disconnecting client for session: ${session_id}`);
        const clientData = clients.get(session_id);
        if (clientData) {
            await clientData.client.destroy();
            clients.delete(session_id);
            io.emit('status', { session_id, message: 'Client disconnected successfully.' });
            io.emit('clearQr', session_id);
        } else {
            io.emit('status', { session_id, message: 'Client not found for this session.' });
        }
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});