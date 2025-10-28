<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Multi-Session Sender</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>WhatsApp Multi-Session Sender</h1>

    <div id="main-container">
        <div class="button-group">
            <button id="create-session-button">Connect New Account</button>
            <button id="cleanup-sessions-button">Clean Up Inactive Sessions</button>
        </div>

        <div class="session-selector">
            <label for="session-select">Select Session:</label>
            <select id="session-select">
                <option value="">-- Select a Session --</option>
            </select>
        </div>

        <div id="sessions-container"></div>

        <h2>Send Message</h2>
        <form id="message-form">
            <input type="text" id="number" placeholder="Enter phone number" required>
            <input type="text" id="message" placeholder="Enter your message">
            <input type="file" id="attachment" accept="image/*,video/*,application/pdf">
            <button type="submit">Send</button>
        </form>
    </div>

    <script src="https://powersoftt.com:3000/socket.io/socket.io.js"></script>

    <script src="script.js?1"></script>

</body>
</html>