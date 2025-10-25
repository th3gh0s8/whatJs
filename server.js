const express = require('express');
const app = express();
const http = require('http');
const { Server } = require("socket.io");
const whatsappClient = require('./whatsapp-client'); // Import the whatsappClient module

const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins in development and specific origins in production
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Credentials", "true");
    next();
});

const io = new Server(server, {
    cors: {
        origin: ["https://powersoftt.com", "https://www.powersoftt.com", "http://localhost:3000", "http://localhost:3001", "*"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true // Allow Engine.IO v3 (older version) for better compatibility
});

// Trust proxy settings for nginx
app.set('trust proxy', true);

whatsappClient.initialize(io); // Initialize whatsappClient with io

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log(`New client connected with socket ID: ${socket.id}`);
    
    // Handle nginx proxy headers
    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    console.log(`Client connected from IP: ${clientIP}`);
    
    const existing = whatsappClient.getExistingSessionIds();

    console.log(`Client connected. Emitting existingSessions: ${existing}`);

    socket.emit('existingSessions', existing);
    
    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected (socket ID: ${socket.id}) - Reason: ${reason}`);
    });

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