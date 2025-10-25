const socket = io('/');

const createSessionButton = document.getElementById('create-session-button');
const cleanupSessionsButton = document.getElementById('cleanup-sessions-button');
const sessionsContainer = document.getElementById('sessions-container');
const messageForm = document.getElementById('message-form');
const numberInput = document.getElementById('number');
const messageInput = document.getElementById('message');
const attachmentInput = document.getElementById('attachment');
const sendAttachmentButton = document.getElementById('send-attachment-button');
const sessionSelect = document.getElementById('session-select');

// Function to create and append session UI
function createSessionUI(session_id) {
    const sessionDiv = document.createElement('div');
    sessionDiv.id = `session-${session_id}`;
    sessionDiv.classList.add('session-card');
    sessionDiv.style.display = 'none'; // Initially hide new sessions
    sessionDiv.innerHTML = `
        <h3>Session ID: ${session_id}</h3>
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

    // Add session to dropdown
    const option = document.createElement('option');
    option.value = session_id;
    option.textContent = session_id;
    sessionSelect.appendChild(option);
}

createSessionButton.addEventListener('click', () => {
    const session_id = `session-${Date.now()}`;
    socket.emit('createSession', session_id);
});

cleanupSessionsButton.addEventListener('click', () => {
    socket.emit('cleanupInactiveSessions');
});

socket.on('qr', (data) => {
    const { session_id, url } = data;
    console.log(`QR event received on client for session ${session_id}, URL length: ${url.length}`);

    // Ensure the session UI exists before trying to update it
    if (!document.getElementById(`session-${session_id}`)) {
        createSessionUI(session_id);
    }

    const sessionDiv = document.getElementById(`session-${session_id}`);
    if (sessionDiv) {
        // The visibility of the sessionDiv is now primarily controlled by the sessionSelect.addEventListener('change', ...)
        // This block only ensures the QR code image is updated.
    }

    const qrcodeDiv = document.getElementById(`qrcode-${session_id}`);
    if (qrcodeDiv) {
        console.log(`Found qrcodeDiv for session ${session_id}`);
        qrcodeDiv.innerHTML = `<img src="${url}">`;
    } else {
        console.log(`qrcodeDiv not found for session ${session_id}`);
    }

    // If this is the first session or only session, select it
    // Removed automatic selection logic. User should explicitly select.
});

socket.on('status', (data) => {
    const { session_id, message } = data;

    // Ensure the session UI exists before trying to update it
    if (!document.getElementById(`session-${session_id}`)) {
        createSessionUI(session_id);
    }

    const statusDiv = document.getElementById(`status-${session_id}`);
    if (statusDiv) {
        statusDiv.innerHTML = message;
        statusDiv.className = 'status-display'; // Reset classes
        if (message.includes('ready')) {
            statusDiv.classList.add('active');
        } else if (message.includes('QR code received') || message.includes('Loading')) {
            statusDiv.classList.add('pending');
        } else if (message.includes('Authentication failed') || message.includes('disconnected') || message.includes('inactive')) {
            statusDiv.classList.add('inactive');
        }
    }
});

socket.on('clearQr', (session_id) => {
    // Remove session from UI and dropdown
    const sessionDiv = document.getElementById(`session-${session_id}`);
    if (sessionDiv) {
        sessionDiv.remove();
    }
    const option = sessionSelect.querySelector(`option[value="${session_id}"]`);
    if (option) {
        option.remove();
    }
    // Reset dropdown and message form if the disconnected session was selected
    if (sessionSelect.value === session_id) {
        sessionSelect.value = '';
        // Hide all session UIs when the selected session is disconnected
        document.querySelectorAll('.session-card').forEach(div => {
            div.style.display = 'none';
        });
    }
});

socket.on('existingSessions', (sessionIds) => {
    console.log(`Received existingSessions on client: ${sessionIds}`);
    sessionIds.forEach(session_id => {
        createSessionUI(session_id);
    });

    // Automatically select the first session if available and no session is currently selected
    if (sessionIds.length > 0 && !sessionSelect.value) {
        sessionSelect.value = sessionIds[0];
        // Trigger the change event to ensure the UI is updated correctly
        sessionSelect.dispatchEvent(new Event('change'));
    }
});

socket.on('connect', () => {
    socket.emit('requestAllSessionStatuses');
});

sessionSelect.addEventListener('change', (e) => {
    const selectedSessionId = e.target.value;

    // Hide all session UIs
    document.querySelectorAll('.session-card').forEach(div => {
        div.style.display = 'none';
    });

    // Show the selected session's UI
    if (selectedSessionId) {
        const selectedSessionDiv = document.getElementById(`session-${selectedSessionId}`);
        if (selectedSessionDiv) {
            selectedSessionDiv.style.display = 'block';
        }
    }
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const session_id = sessionSelect.value; // Get session ID from dropdown instead of hidden textbox
    const number = numberInput.value;
    const message = messageInput.value;
    const attachment = attachmentInput.files[0];

    if (!session_id) {
        alert('Please select a session to send messages from.');
        return;
    }

    if (!message && !attachment) {
        alert('Please enter a message or select an attachment to send.');
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
