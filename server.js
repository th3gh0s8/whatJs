const express = require('express');
const app = express();
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require("socket.io");
const whatsappClient = require('./whatsapp-client'); // Import the whatsappClient module

let server;
const PORT = process.env.PORT || 3000;

// Check for SSL certificates
const privateKeyPath = './certs/key.pem';
const certificatePath = './certs/cert.pem';

if (fs.existsSync(privateKeyPath) && fs.existsSync(certificatePath)) {
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    const certificate = fs.readFileSync(certificatePath, 'utf8');
    const credentials = { key: privateKey, cert: certificate };
    server = https.createServer(credentials, app);
    console.log('HTTPS server created.');
} else {
    server = http.createServer(app);
    console.log('HTTP server created. For HTTPS, place key.pem and cert.pem in the ./certs directory.');
}

const io = new Server(server, {
    cors: {
        origin: "https://powersoftt.com", // Updated for production domain
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

whatsappClient.initialize(io); // Initialize whatsappClient with io

app.use(express.static(__dirname));

io.on('connection', (socket) => {

    const existing = whatsappClient.getExistingSessionIds();

    console.log(`Client connected. Emitting existingSessions: ${existing}`);

    socket.emit('existingSessions', existing);

    socket.on('createSession', (session_id) => {
        whatsappClient.createSession(session_id, io);
    });

    socket.on('sendMessage', async (data) => {
        const { session_id, number, message } = data;
        const result = await whatsappClient.sendMessage(session_id, number, message);
        io.emit('status', { session_id, message: result.message });
    });

    socket.on('sendAttachment', async (data) => {
        const { session_id, number, base64Data, filename, mimetype } = data;
        const result = await whatsappClient.sendAttachment(session_id, number, base64Data, filename, mimetype);
        io.emit('status', { session_id, message: result.message });
    });

    socket.on('disconnectClient', async (session_id) => {
        const result = await whatsappClient.disconnectClient(session_id);
        io.emit('status', { session_id, message: result.message });
        if (result.success) {
            io.emit('clearQr', session_id);
        }
    });

    socket.on('sendCombinedMessage', async (data) => {
        const { session_id, number, message, base64Data, filename, mimetype } = data;
        const result = await whatsappClient.sendCombinedMessage(session_id, number, message, base64Data, filename, mimetype);
        io.emit('status', { session_id, message: result.message });
    });

    socket.on('requestAllSessionStatuses', () => {
        const allSessions = whatsappClient.getAllSessions();
        for (const session_id in allSessions) {
            const statusMessage = allSessions[session_id].status === 'active' ? 'Client is ready!' : allSessions[session_id].status === 'pending' ? 'Waiting for QR...' : 'Inactive';
            socket.emit('status', { session_id, message: statusMessage });
        }
    });

    socket.on('requestSessionStatus', (session_id) => {
        const allSessions = whatsappClient.getAllSessions();
        if (allSessions[session_id]) {
            const statusMessage = allSessions[session_id].status === 'active' ? 'Client is ready!' : allSessions[session_id].status === 'pending' ? 'Waiting for QR...' : 'Inactive';
            socket.emit('status', { session_id, message: statusMessage });
        } else {
            socket.emit('status', { session_id, message: 'Client not found.' });
        }
    });

    socket.on('cleanupInactiveSessions', () => {
        whatsappClient.cleanupInactiveSessions();
        io.emit('status', { session_id: 'system', message: 'Inactive sessions cleaned up.' });
    });
});

server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});