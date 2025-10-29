const socket = io('https://powersoftt.com:3000');
var session_id = $('#sessidwhats').val();
if (session_id) {
    socket.emit('joinSession', session_id);
    socket.emit('requestSessionStatus', session_id);
}

$(document).on('click', '#create-session-button', function () {
    var expses = $(this).attr('expses');
    const session_id = `session-${Math.random().toString(36).substring(2, 10)}${expses}`;
    socket.emit('createSession', session_id);
    var brID = $('#brIDHiddn').val();
    
    $.ajax({
        url: '/Home/ajxNew/xWhatBot.php',
        data: {
            'brrID': brID,
            'session_id': session_id,
            'btn': 'UpdateSession'
        },
        type: 'POST',
        dataType: 'json',
        success: function(data){
            $('#sessidwhats').val(session_id);
            $('.session-card').show();
            $('.testWhatsappForm').show();
            $(`#qrcode-${session_id}`).show();
        }
    })
});

function createSessionUI(session_id) {
    const $sessionDiv = $(`
        <div id="session-${session_id}" class="session-card">
            <h3>Session ID: ${session_id}</h3>
            <div id="qrcode-${session_id}" class="qrcode-display"></div>
            <div id="status-${session_id}" class="status-display">Waiting for QR...</div>
            <button class="disconnect-button" data-session-id="${session_id}">Disconnect</button>
            <hr>
        </div>
    `);
    $('#sessions-container').append($sessionDiv);

    $sessionDiv.find('.disconnect-button').on('click', function () {
        const sid = $(this).data('session-id');
        socket.emit('disconnectClient', sid);
    });
}

socket.on('qr', function (data) {
    //if (data.session_id !== session_id) return;
    const { session_id, url } = data;
    console.log(`QR received for ${session_id}, URL length: ${url.length}`);

    if (!$(`#session-${session_id}`).length) {
        createSessionUI(session_id);
    }

    const $qrcodeDiv = $(`#qrcode-${session_id}`);
    if ($qrcodeDiv.length) {
        console.log(`Found qrcodeDiv for ${session_id}`);
        $qrcodeDiv.html(`<img src="${url}">`);
    } else {
        console.log(`qrcodeDiv not found for ${session_id}`);
    }
});

// Receive Status
socket.on('status', function (data) {
    if (data.session_id !== session_id) return;
    const { message } = data;

    if (!$(`#session-${session_id}`).length) {
        createSessionUI(session_id);
    }

    const $statusDiv = $(`#status-${session_id}`);
    if ($statusDiv.length) {
        $statusDiv
            .removeClass('active pending inactive')
            .text(message);

        if (message.includes('ready')) {
            $statusDiv.addClass('active');
            $(`#qrcode-${session_id}`).hide();
        } else if (message.includes('QR code received') || message.includes('Loading')) {
            $statusDiv.addClass('pending');
        } else if (message.includes('Authentication failed') || message.includes('disconnected') || message.includes('inactive')) {
            $statusDiv.addClass('inactive');
        }else if(message.includes('Client not found')){
            $('#create-session-button').show();
            $('.session-card').hide();
            $('.testWhatsappForm').hide();
        }
    }
});

// Clear QR (disconnected session)
socket.on('clearQr', function (session_id) {
    $(`#session-${session_id}`).remove();
    var brID = $('#brIDHiddn').val();
    
    $.ajax({
        url: '/Home/ajxNew/xWhatBot.php',
        data: {
            'brrID': brID,
            'session_id': session_id,
            'btn': 'UpdateSessionStatus'
        },
        type: 'POST',
        dataType: 'json',
        success: function(data){
            if(data.success === true){
                $('.session-card').hide();
                $('#sessidwhats').val('');
            }
        }
    })
});

// Existing Sessions
// socket.on('existingSessions', function (sessionIds) {
//     console.log(`Existing sessions: ${sessionIds}`);
//     sessionIds.forEach(function (session_id) {
//         createSessionUI(session_id);
//     });
// });

// On socket connect, get all statuses
socket.on('connect', function () {
    var sessidwhats = $('#sessidwhats').val();
    socket.emit('joinSession', session_id);
    socket.emit('requestSessionStatus', sessidwhats);
});



$('#message-form').on('submit', function (e) {
    e.preventDefault();
    var session_id = $('#sessidwhats').val();
    const number = $('#testWhatsappNum').val();
    const message = $('#testWhatsappMsg').val();
    const attachment = $('#testWhatsappAttachment')[0].files[0];

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
        reader.onloadend = function () {
            const base64Data = reader.result.split(';base64,')[1];
            socket.emit('sendCombinedMessage', {
                session_id,
                number,
                message,
                base64Data,
                filename: attachment.name,
                mimetype: attachment.type
            });
        };
        reader.readAsDataURL(attachment);
    } else if (message) {
        socket.emit('sendMessage', { session_id, number, message });
    } else if (attachment) {
        const reader = new FileReader();
        reader.onloadend = function () {
            const base64Data = reader.result.split(';base64,')[1];
            socket.emit('sendAttachment', {
                session_id,
                number,
                base64Data,
                filename: attachment.name,
                mimetype: attachment.type
            });
        };
        reader.readAsDataURL(attachment);
    }

    // Reset inputs
    $('#testWhatsappMsg').val('');
    $('#testWhatsappAttachment').val('');
});