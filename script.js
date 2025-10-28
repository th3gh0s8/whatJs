const socket = io('http://localhost:3000');

// UI Elements
const createSessionButton = document.getElementById('create-session-button');
const cleanupSessionsButton = document.getElementById('cleanup-sessions-button');
const sessionsContainer = document.getElementById('sessions-container');
const messageForm = document.getElementById('message-form');
const sessionIdSendInput = document.getElementById('session-id-send');
const numberInput = document.getElementById('number');
const messageInput = document.getElementById('message');
const attachmentInput = document.getElementById('attachment');
const notifications = document.getElementById('notifications');
const sessionButtons = document.querySelectorAll('.tab-button');

// State
let activeSessions = [];

// -------------------
// -- Notifications --
// -------------------

function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
    notification.textContent = message;
    notifications.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notifications.removeChild(notification);
        }, 300);
    }, 3000);
}

// -------------------
// -- Session UI    --
// -------------------

function createSessionUI(session_id) {
    const sessionDiv = document.createElement('div');
    sessionDiv.id = `session-${session_id}`;
    sessionDiv.classList.add('session-card');
    sessionDiv.style.display = 'none'; // Initially hide new sessions
    sessionDiv.innerHTML = `
        <div id="qrcode-${session_id}" class="qrcode-display"></div>
        <div id="status-${session_id}" class="status-display">Waiting for QR...</div>
        <button class="disconnect-button" data-session-id="${session_id}">Disconnect</button>
        <hr>
    `;
    sessionsContainer.appendChild(sessionDiv);

    // Add event listener for the disconnect button
    sessionDiv.querySelector('.disconnect-button').addEventListener('click', (e) => {
        const sid = e.target.dataset.sessionId;
        socket.emit('disconnectClient', sid);
    });
}

function updateButtonUI() {
    sessionButtons.forEach(button => {
        const sessionId = button.dataset.sessionId;
        if (activeSessions.includes(sessionId)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// -------------------
// -- Socket Events --
// -------------------

function setupSocketListeners() {
    socket.on('qr', (data) => {
        const { session_id, url } = data;
        console.log(`QR event received on client for session ${session_id}`);

        if (!document.getElementById(`session-${session_id}`)) {
            createSessionUI(session_id);
        }

        const qrcodeDiv = document.getElementById(`qrcode-${session_id}`);
        if (qrcodeDiv) {
            qrcodeDiv.innerHTML = `<img src="${url}">`;
        }

        const buttonToClick = Array.from(sessionButtons).find(btn => btn.dataset.sessionId === session_id);
        if (buttonToClick) {
            buttonToClick.click();
        }
    });

    socket.on('status', (data) => {
        const { session_id, message } = data;

        if (!document.getElementById(`session-${session_id}`)) {
            createSessionUI(session_id);
        }

        const statusDiv = document.getElementById(`status-${session_id}`);
        if (statusDiv) {
            statusDiv.innerHTML = message;
        }

        if (message === 'Client is ready!' && !activeSessions.includes(session_id)) {
            activeSessions.push(session_id);
            updateButtonUI();
        }
    });

    socket.on('clearQr', (session_id) => {
        const sessionDiv = document.getElementById(`session-${session_id}`);
        if (sessionDiv) {
            sessionDiv.remove();
        }

        activeSessions = activeSessions.filter(id => id !== session_id);
        updateButtonUI();

        if (sessionIdSendInput.value === session_id) {
            sessionIdSendInput.value = '';
        }
    });

    socket.on('existingSessions', (sessionIds) => {
        console.log(`Received existingSessions on client: ${sessionIds}`);
        activeSessions = sessionIds;
        activeSessions.forEach(session_id => {
            createSessionUI(session_id);
        });
        updateButtonUI();
    });

    socket.on('connect', () => {
        socket.emit('requestAllSessionStatuses');
    });
}

// -------------------
// -- Event Listeners --
// -------------------

createSessionButton.addEventListener('click', () => {
    const allSessionIds = Array.from(sessionButtons).map(btn => btn.dataset.sessionId);
    const nextSessionId = allSessionIds.find(id => !activeSessions.includes(id));

    if (nextSessionId) {
        socket.emit('createSession', nextSessionId);
    } else {
        showNotification('All sessions are currently active.', true);
    }
});

cleanupSessionsButton.addEventListener('click', () => {
    socket.emit('cleanupInactiveSessions');
});

sessionButtons.forEach(button => {
    button.addEventListener('click', () => {
        const sessionId = button.dataset.sessionId;
        sessionIdSendInput.value = sessionId;

        // Update active class
        sessionButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Hide all session cards
        document.querySelectorAll('.session-card').forEach(div => {
            div.style.display = 'none';
        });

        // Show the selected session card
        const sessionDiv = document.getElementById(`session-${sessionId}`);
        if (sessionDiv) {
            sessionDiv.style.display = 'block';
        } else {
            // If the session UI doesn't exist, maybe create it or wait for status
            // For now, we just ensure the input is set.
        }
    });
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const session_id = sessionIdSendInput.value;
    const number = numberInput.value;
    const message = messageInput.value;
    const attachment = attachmentInput.files[0];

    if (!session_id) {
        showNotification('Please select a session to send messages from.', true);
        return;
    }

    if (!message && !attachment) {
        showNotification('Please enter a message or select an attachment to send.', true);
        return;
    }

    if (message && attachment) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(';base64,')[1];
            socket.emit('sendCombinedMessage', {
                session_id,
                number,
                message,
                base64Data,
                filename: attachment.name,
                mimetype: attachment.type,
            });
        };
        reader.readAsDataURL(attachment);
    } else if (message) {
        socket.emit('sendMessage', { session_id, number, message });
    } else if (attachment) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(';base64,')[1];
            socket.emit('sendAttachment', {
                session_id,
                number,
                base64Data,
                filename: attachment.name,
                mimetype: attachment.type,
            });
        };
        reader.readAsDataURL(attachment);
    }

    // Clear inputs after sending
    messageInput.value = '';
    attachmentInput.value = '';
});

// -------------------
// -- Initialization --
// -------------------

setupSocketListeners();

