<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Multi-Session Sender</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="notifications"></div>
    <div class="container">
        <h1>WhatsApp Multi-Session Sender</h1>
        <button id="cleanup-sessions-button">Clean Up Inactive Sessions</button>

        <div id="session-tabs">
            <button class="tab-button" data-session-id="0041">0041</button>
            <button class="tab-button" data-session-id="0042">0042</button>
            <button class="tab-button" data-session-id="0043">0043</button>
            <button class="tab-button" data-session-id="0044">0044</button>
            <button class="tab-button" data-session-id="0045">0045</button>
        </div>

        <div id="sessions-container"></div>

        <h2>Send Message</h2>
        <form id="message-form">
            <input type="hidden" id="session-id-send" required>
            <input type="text" id="number" placeholder="Enter phone number" required>
            <input type="text" id="message" placeholder="Enter your message">
            <input type="file" id="attachment" accept="image/*,video/*,application/pdf">
            <button type="submit">Send</button>
        </form>
    </div>

    <script src="http://localhost:3000/socket.io/socket.io.js"></script>
    <script src="script.js"></script>
</body>
</html>