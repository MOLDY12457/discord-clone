const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://*.onrender.com'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

const messagesFile = path.join(__dirname, 'messages.json');
let isSaving = false;
let messageQueue = [];

async function saveMessages() {
  if (isSaving) {
    return new Promise(resolve => messageQueue.push(resolve));
  }
  isSaving = true;
  try {
    const messages = await loadMessages();
    while (messageQueue.length > 0) {
      const newMessage = await new Promise(resolve => resolve(messageQueue.shift().()));
      messages.push(newMessage);
    }
    await fs.writeFile(messagesFile, JSON.stringify(messages, null, 2), 'utf8');
    console.log('Messages sauvegardés:', messages.length);
  } catch (err) {
    console.error('Erreur sauvegarde messages:', err);
  } finally {
    isSaving = false;
    if (messageQueue.length > 0) saveMessages();
  }
}

async function loadMessages() {
  try {
    const data = await fs.readFile(messagesFile, 'utf8');
    return JSON.parse(data) || [];
  } catch (err) {
    console.log('Fichier messages inexistant ou vide, création d\'un nouveau:', err);
    await fs.writeFile(messagesFile, '[]', 'utf8');
    return [];
  }
}

let users = [];

io.on('connection', (socket) => {
  console.log('Nouvelle connexion:', socket.id);
  const username = socket.handshake.query.username;
  console.log('Pseudo reçu:', username);

  if (!username) {
    console.error('Pseudo manquant pour socket:', socket.id);
    socket.disconnect();
    return;
  }

  users.push({ id: socket.id, name: username });
  console.log('Users mis à jour:', users);
  io.emit('users', users);

  socket.on('loadMessages', async () => {
    try {
      const messages = await loadMessages();
      socket.emit('messages', messages);
      console.log('Messages envoyés à', socket.id, ':', messages.length);
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    }
  });

  socket.on('message', async (msg) => {
    console.log('Message général de', msg.from, ':', msg.text);
    try {
      const newMessage = { from: msg.from, text: msg.text, timestamp: new Date().toISOString() };
      io.emit('message', newMessage);
      await saveMessages(newMessage);
    } catch (err) {
      console.error('Erreur gestion message:', err);
    }
  });

  socket.on('offer', ({ to, offer }) => {
    console.log('Offer de', socket.id, 'à', to);
    socket.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    console.log('Answer de', socket.id, 'à', to);
    socket.to(to).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    console.log('ICE de', socket.id, 'à', to);
    socket.to(to).emit('ice-candidate', { candidate });
  });

  socket.on('disconnect', (reason) => {
    console.log('Déconnexion:', socket.id, 'raison:', reason);
    users = users.filter(user => user.id !== socket.id);
    console.log('Users après déconnexion:', users);
    io.emit('users', users);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur sur http://localhost:${PORT}`);
});
