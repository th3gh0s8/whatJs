const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');

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

const clients = new Map();
let allSessions = readSessionsFromFile();

const initializationQueue = [];
let isProcessingQueue = false;

function processInitializationQueue(io) {
    if (initializationQueue.length > 0 && !isProcessingQueue) {
        isProcessingQueue = true;
        const session_id = initializationQueue.shift();
        console.log(`[Server] Processing initialization queue for session: ${session_id}`);
        initializeWhatsAppClient(session_id, io).then(() => {
            console.log(`[Server] Finished initializing client for session: ${session_id}`);
            isProcessingQueue = false;
            processInitializationQueue(io); // Process next in queue
        }).catch(error => {
            console.error(`[Server] Error initializing client for session ${session_id}:`, error);
            isProcessingQueue = false;
            processInitializationQueue(io); // Process next in queue even if one fails
        });
    }
}

function initializeWhatsAppClient(session_id, io) {
    return new Promise((resolve, reject) => {
        console.log(`Initializing WhatsApp client for session: ${session_id}`);
        
        // Set up a timeout to handle stuck initializations
        const initTimeout = setTimeout(() => {
            console.log(`[Server] Initialization timeout for session ${session_id}`);
            // Clean up any partial initialization
            if (clients.has(session_id)) {
                const clientData = clients.get(session_id);
                if (clientData.client) {
                    clientData.client.destroy().catch(err => console.error('Error destroying client:', err));
                }
                clients.delete(session_id);
            }
            // Mark as inactive to allow retry
            if (allSessions[session_id]) {
                allSessions[session_id].status = 'inactive';
                writeSessionsToFile(allSessions);
            }
            reject(new Error(`Initialization timeout for session ${session_id}`));
        }, 45000); // 45 second timeout for initialization

        const client = new Client({
            authStrategy: new LocalAuth({ clientId: session_id }),
            puppeteer: {
                args: ['--no-sandbox'],
                headless: true,  // Ensure headless mode to avoid issues on servers
            }
        });

        clients.set(session_id, { client, ready: false, messageQueue: [] });
        allSessions[session_id] = { status: 'pending' };
        writeSessionsToFile(allSessions);

        // Clear timeout when initialization completes successfully
        const clearInitTimeout = () => {
            clearTimeout(initTimeout);
        };

        client.on('qr', (qr) => {
            console.log(`[Server] QR event received for session ${session_id}`);
            io.emit('status', { session_id, message: 'QR code received, please scan.' });
            qrcode.toDataURL(qr, (err, url) => {
                if (err) {
                    console.error(`[Server] Error generating QR code for session ${session_id}:`, err);
                    io.emit('status', { session_id, message: `Error generating QR: ${err.message}` });
                    clearInitTimeout();
                    return;
                }
                console.log(`[Server] Emitting QR code for session ${session_id}, URL length: ${url.length}`);
                io.emit('qr', { session_id, url });
                clearInitTimeout();
                resolve(); // Resolve the promise here to allow the queue to continue
            });
        });

        client.on('auth_failure', (msg) => {
            console.log(`[Server] Auth Failure for session ${session_id}: ${msg}`);
            io.emit('status', { session_id, message: `Authentication failed: ${msg}` });
            // Mark session as inactive on auth failure
            if (allSessions[session_id]) {
                allSessions[session_id].status = 'inactive';
                writeSessionsToFile(allSessions);
            }
            clearInitTimeout();
            reject(new Error(`Authentication failed for session ${session_id}: ${msg}`));
        });

        client.on('authenticated', () => {
            console.log(`[Server] Client authenticated for session ${session_id}`);
            io.emit('status', { session_id, message: 'Client authenticated!' });
        });

        client.on('loading_screen', (percent, message) => {
            console.log(`[Server] Loading screen for session ${session_id}: ${percent}% - ${message}`);
            io.emit('status', { session_id, message: `Loading: ${percent}% - ${message}` });
        });

        client.on('disconnected', (reason) => {
            console.log(`[Server] Client disconnected for session ${session_id}: ${reason}`);
            io.emit('clearQr', session_id);
            if (clients.has(session_id)) {
                const sessionData = clients.get(session_id);
                sessionData.ready = false;
                // Clear message queue when disconnected
                sessionData.messageQueue = [];
                clients.delete(session_id);
            }
            // Mark session as inactive on disconnect
            if (allSessions[session_id]) {
                allSessions[session_id].status = 'inactive';
                writeSessionsToFile(allSessions);
            }
            clearInitTimeout();
            resolve(); // Resolve on disconnect as well
        });

        client.on('ready', () => {
            io.emit('status', { session_id, message: 'Client is ready!' });
            console.log(`Client for session ${session_id} is ready!`);
            const sessionData = clients.get(session_id);
            sessionData.ready = true;
            // Mark session as active on ready
            if (allSessions[session_id]) {
                allSessions[session_id].status = 'active';
                writeSessionsToFile(allSessions);
            }
            // Process queued messages for this session
            while (sessionData.messageQueue.length > 0) {
                const message = sessionData.messageQueue.shift();
                client.sendMessage(message.number, message.message).catch(err => {
                    console.error(`Error sending queued message:`, err);
                });
            }
            clearInitTimeout();
            resolve();
        });

        client.initialize().then(() => {
            console.log(`[Server] client.initialize() started for session ${session_id}`);
            // Initialization successful, but client might not be ready yet
        }).catch(err => {
            console.error(`Error during client.initialize() for session ${session_id}:`, err);
            io.emit('status', { session_id, message: `Initialization failed: ${err.message}` });
            clients.delete(session_id); // Remove client from map if initialization fails
            // Mark session as inactive on initialization failure
            if (allSessions[session_id]) {
                allSessions[session_id].status = 'inactive';
                writeSessionsToFile(allSessions);
            }
            clearInitTimeout();
            reject(err);
        });
    });
}

function createSession(session_id, io) {
    // If a client with this session_id already exists, destroy it first
    if (clients.has(session_id)) {
        const existingClientData = clients.get(session_id);
        if (existingClientData.client) {
            existingClientData.client.destroy().catch(err => 
                console.error(`Error destroying existing client for session ${session_id}:`, err)
            );
        }
        clients.delete(session_id);
    }
    
    if (!allSessions[session_id]) {
        allSessions[session_id] = { status: 'pending' };
        writeSessionsToFile(allSessions);
        io.emit('newSessionCreated', session_id); // Emit event to client
    } else {
        // Update status when creating a new session
        allSessions[session_id].status = 'pending';
        writeSessionsToFile(allSessions);
    }
    initializationQueue.push(session_id);
    processInitializationQueue(io);
}

async function sendMessage(session_id, number, message) {
    const clientData = clients.get(session_id);

    if (!clientData) {
        return { success: false, message: 'Client not found for this session.' };
    }

    const { client, ready } = clientData;
    const formattedNumber = `${number}@c.us`;

    console.log(`Attempting to send message from session ${session_id} to ${formattedNumber}: ${message}`);
    console.log(`Client ready status for session ${session_id}: ${ready}`);

    if (ready) {
        try {
            const response = await client.sendMessage(formattedNumber, message);
            console.log('Message sent successfully:', response);
            return { success: true, message: `Message sent to ${number}` };
        } catch (error) {
            console.error('Error sending message:', error);
            return { success: false, message: `Error sending message to ${number}: ${error.message}` };
        }
    } else {
        clientData.messageQueue.push({ number: formattedNumber, message });
        return { success: true, message: 'Client not ready, message queued.' };
    }
}

async function sendAttachment(session_id, number, base64Data, filename, mimetype) {
    const clientData = clients.get(session_id);

    if (!clientData) {
        return { success: false, message: 'Client not found for this session.' };
    }

    const { client, ready } = clientData;
    const formattedNumber = `${number}@c.us`;

    console.log(`Attempting to send attachment from session ${session_id} to ${formattedNumber}: ${filename}`);

    if (ready) {
        try {
            const media = new MessageMedia(mimetype, base64Data, filename);
            await client.sendMessage(formattedNumber, media);
            return { success: true, message: `Attachment ${filename} sent to ${number}` };
        } catch (error) {
            console.error('Error sending attachment:', error);
            return { success: false, message: `Error sending attachment to ${number}: ${error.message}` };
        }
    } else {
        return { success: false, message: 'Client not ready, attachment not sent.' };
    }
}

async function sendCombinedMessage(session_id, number, message, base64Data, filename, mimetype) {
    const clientData = clients.get(session_id);

    if (!clientData) {
        return { success: false, message: 'Client not found for this session.' };
    }

    const { client, ready } = clientData;
    const formattedNumber = `${number}@c.us`;

    console.log(`Attempting to send combined message and attachment from session ${session_id} to ${formattedNumber}: ${filename} with caption: ${message}`);

    if (ready) {
        try {
            const media = new MessageMedia(mimetype, base64Data, filename);
            await client.sendMessage(formattedNumber, media, { caption: message });
            return { success: true, message: `Combined message and attachment ${filename} sent to ${number}` };
        } catch (error) {
            console.error('Error sending combined message and attachment:', error);
            return { success: false, message: `Error sending combined message and attachment to ${number}: ${error.message}` };
        }
    } else {
        return { success: false, message: 'Client not ready, combined message and attachment not sent.' };
    }
}

async function disconnectClient(session_id) {
    console.log(`Disconnecting client for session: ${session_id}`);
    const clientData = clients.get(session_id);
    if (clientData) {
        try {
            await clientData.client.destroy();
            console.log(`Client for session ${session_id} destroyed.`);
        } catch (error) {
            console.error(`Error destroying client for session ${session_id}:`, error);
        }
        clients.delete(session_id);
        // Mark session as inactive in allSessions
        if (allSessions[session_id]) {
            allSessions[session_id].status = 'inactive';
            writeSessionsToFile(allSessions);
        }
        return { success: true, message: 'Client disconnected successfully.' };
    } else {
        return { success: false, message: 'Client not found for this session.' };
    }
}

function getExistingSessionIds() {
    return Object.keys(allSessions);
}

function cleanupInactiveSessions() {
    const sessionDir = './.wwebjs_auth';
    let sessionsModified = false;

    for (const session_id in allSessions) {
        if (allSessions[session_id].status === 'inactive') {
            const clientAuthDir = `${sessionDir}/session-${session_id}`;
            if (fs.existsSync(clientAuthDir)) {
                fs.rmSync(clientAuthDir, { recursive: true, force: true });
                console.log(`Cleaned up inactive session directory: ${clientAuthDir}`);
            }
            delete allSessions[session_id];
            sessionsModified = true;
        }
    }

    // Also clean up any auth directories that don't have corresponding entries in sessions.json
    if (fs.existsSync(sessionDir)) {
        const authDirs = fs.readdirSync(sessionDir);
        for (const dir of authDirs) {
            if (dir.startsWith('session-')) {
                const sessionMatch = dir.match(/session-(.*)/);
                if (sessionMatch) {
                    const sessionId = sessionMatch[1];
                    if (!allSessions[sessionId]) {
                        // This auth directory doesn't have a corresponding session in sessions.json
                        const orphanedDir = `${sessionDir}/${dir}`;
                        fs.rmSync(orphanedDir, { recursive: true, force: true });
                        console.log(`Cleaned up orphaned session directory: ${orphanedDir}`);
                    }
                }
            }
        }
    }

    if (sessionsModified) {
        writeSessionsToFile(allSessions);
    }
}

function initialize(io) {
    console.log('[Server] Initializing WhatsApp clients on startup');
    
    // Run cleanup on server startup
    cleanupInactiveSessions();

    // Clean up any pending sessions that might be stale from previous runs
    for (const session_id in allSessions) {
        if (allSessions[session_id].status === 'pending') {
            // Check if authentication data exists for this session
            // If it was in QR scanning state but never completed, it might be stale
            const authDir = `./.wwebjs_auth/session-${session_id}`;
            if (!fs.existsSync(authDir)) {
                // No auth data exists, this session was never started properly
                // Mark as inactive so it can be retried
                allSessions[session_id].status = 'inactive';
                writeSessionsToFile(allSessions);
            } else {
                // Auth directory exists but session is still pending - this might be a session 
                // that was in QR scanning state when the server was stopped
                console.log(`[Server] Found pending session ${session_id}, will attempt to reconnect`);
            }
        } else if (allSessions[session_id].status === 'active') {
            // For active sessions, reset to pending so we try to reconnect
            console.log(`[Server] Found active session ${session_id} from previous run, will attempt to reconnect`);
            allSessions[session_id].status = 'pending';
        }
    }

    // Initialize existing sessions on server startup
    Object.keys(allSessions).forEach(session_id => {
        if (allSessions[session_id].status === 'active' || allSessions[session_id].status === 'pending') {
            // Add to initialization queue
            initializationQueue.push(session_id);
        }
    });
    
    console.log(`[Server] Queued ${initializationQueue.length} sessions for initialization`);
    processInitializationQueue(io);
}

function getAllSessions() {
    return allSessions;
}

module.exports = {
    createSession,
    sendMessage,
    sendAttachment,
    sendCombinedMessage,
    disconnectClient,
    getExistingSessionIds,
    cleanupInactiveSessions,
    initialize,
    getAllSessions,
};
