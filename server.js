const express = require('express');
const app = express();
const http = require('http'); // Only http is needed
const { Server } = require("socket.io");
const whatsappClient = require('./whatsapp-client'); // Import the whatsappClient module

const server = http.createServer(app); // Create an HTTP server directly
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
    cors: {
        origin: "https://powersoftt.com", // Keep this for production domain
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