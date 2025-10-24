const socket = io();

const form = document.getElementById('message-form');
const numberInput = document.getElementById('number');
const messageInput = document.getElementById('message');
const qrcodeDiv = document.getElementById('qrcode');

const statusDiv = document.getElementById('status');

socket.on('status', (status) => {
    statusDiv.innerHTML = status;
});

socket.on('qr', (qr) => {
    qrcodeDiv.innerHTML = `<img src="${qr}">`;
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const number = numberInput.value;
    const message = messageInput.value;
    socket.emit('sendMessage', { number, message });
});