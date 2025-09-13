const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { PeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Permettre les connexions depuis n'importe quelle origine
    methods: ['GET', 'POST'],
  },
});

// Serveur PeerJS pour WebRTC (port dynamique pour Render)
const peerServer = PeerServer({
  port: process.env.PEER_PORT || 10000,
  path: '/peer',
});

// Servir les fichiers statiques
app.use(express.static('public'));

// Stockage des utilisateurs
const users = {};

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log('Nouvel utilisateur connecté:', socket.id);

  // Enregistrement du nom d'utilisateur
  socket.on('setUsername', (username) => {
    users[socket.id] = username;
    io.emit('userList', Object.values(users));
  });

  // Réception et diffusion des messages
  socket.on('chatMessage', (data) => {
    io.to(data.channel).emit('chatMessage', {
      user: users[socket.id] || 'Anonyme',
      message: data.message,
      timestamp: new Date().toLocaleTimeString(),
    });
  });

  // Rejoindre un salon
  socket.on('joinChannel', (channel) => {
    socket.join(channel);
    console.log(`${users[socket.id] || socket.id} a rejoint le salon: ${channel}`);
  });

  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté:', users[socket.id] || socket.id);
    delete users[socket.id];
    io.emit('userList', Object.values(users));
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
