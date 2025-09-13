const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.static('public'));

const users = {};
const channels = {};

io.on('connection', (socket) => {
  console.log('Nouvel utilisateur connecté:', socket.id);

  socket.on('setUsername', ({ username, peerId }) => {
    users[socket.id] = { username, peerId };
    socket.emit('userList', Object.values(users));
    io.emit('userList', Object.values(users));
  });

  socket.on('joinChannel', (channel) => {
    socket.join(channel);
    channels[socket.id] = channel;
    socket.emit('userList', Object.values(users));
  });

  socket.on('chatMessage', (data) => {
    const timestamp = new Date().toLocaleTimeString();
    io.to(data.channel).emit('chatMessage', {
      user: users[socket.id]?.username || 'Anonyme',
      message: data.message,
      timestamp,
    });
  });

  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté:', socket.id);
    delete users[socket.id];
    delete channels[socket.id];
    io.emit('userList', Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
