const express = require('express');
const app = express();

const https = require('https');

const { Server } = require("socket.io");
const fs = require('fs');
const options = {
  key: fs.readFileSync('pw-cert/powersoftt.key'),   // adjust path
  cert: fs.readFileSync('pw-cert/powersoftt.crt'),
  ca: fs.readFileSync('pw-cert/powersoftt-ca-bundle.crt') // optional but recommended
};

const server = https.createServer(options, app);

const io = new Server(server, {
    cors: {
        origin: "https://powersoftt.com",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'] // Explicitly define transports
});
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');


const SESSION_FILE = 'sessions.json';

// Function to read sessions from file
function readSessionsFromFile() {
    if (fs.existsSync(SESSION_FILE)) {
        const data = fs.readFileSync(SESSION_FILE, 'utf8');
        return JSON.parse(data);
    }
    return {};
}

// Function to write sessions to file
function writeSessionsToFile(sessions) {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

const qrcode = require('qrcode');

const clients = new Map(); // Stores WhatsApp clients by session_id
let allSessions = readSessionsFromFile(); // Load all session data from file

// Re-initialize clients map from allSessions for active sessions
Object.keys(allSessions).forEach(session_id => {
    if (allSessions[session_id].status === 'active' || allSessions[session_id].status === 'pending') {
        // We don't re-initialize the client here, just prepare the map for active clients
        // The actual client initialization will happen via processInitializationQueue
        clients.set(session_id, { client: null, ready: false, messageQueue: [] });
    }

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