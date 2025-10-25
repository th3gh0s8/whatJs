const socket = io();

const createSessionButton = document.getElementById('create-session-button');
const sessionsContainer = document.getElementById('sessions-container');
const messageForm = document.getElementById('message-form');
const sessionIdSendInput = document.getElementById('session-id-send');
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
    createSessionUI(session_id);
    socket.emit('createSession', session_id);
});

socket.on('qr', (data) => {
    const { session_id, url } = data;
    const qrcodeDiv = document.getElementById(`qrcode-${session_id}`);
    if (qrcodeDiv) {
        qrcodeDiv.innerHTML = `<img src="${url}">`;
    }
    // If this is the first session or only session, select it
    if (sessionSelect.options.length === 2) { // 1 for default option, 1 for new session
        sessionSelect.value = session_id;
        sessionSelect.dispatchEvent(new Event('change'));
    }
});

socket.on('status', (data) => {
    const { session_id, message } = data;
    const statusDiv = document.getElementById(`status-${session_id}`);
    if (statusDiv) {
        statusDiv.innerHTML = message;
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
        sessionIdSendInput.value = '';
    }
});

sessionSelect.addEventListener('change', (e) => {
    const selectedSessionId = e.target.value;
    sessionIdSendInput.value = selectedSessionId;

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
    const session_id = sessionIdSendInput.value;
    const number = numberInput.value;
    const message = messageInput.value;

    if (!session_id) {
        alert('Please select a session to send messages from.');
        return;
    }

    if (message) { // Only send text message if message input is not empty
        socket.emit('sendMessage', { session_id, number, message });
    } else {
        alert('Please enter a message or select an attachment to send.');
    }
});

sendAttachmentButton.addEventListener('click', () => {
    const session_id = sessionIdSendInput.value;
    const number = numberInput.value;
    const attachment = attachmentInput.files[0];

    if (!session_id) {
        alert('Please select a session to send attachments from.');
        return;
    }

    if (!attachment) {
        alert('Please select an attachment to send.');
        return;
    }

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
});
