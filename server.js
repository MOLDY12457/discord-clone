const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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

  socket.on('message', (msg) => {
    console.log('Message général de', msg.from, ':', msg.text);
    io.emit('message', { from: msg.from, text: msg.text });
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
