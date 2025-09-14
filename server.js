const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // À ajuster pour la production
    methods: ['GET', 'POST']
  }
});

app.use(express.static(path.join(__dirname, 'public')));

let users = [];

io.on('connection', socket => {
  const username = socket.handshake.query.username;
  users.push({ id: socket.id, name: username });
  io.emit('users', users);

  socket.on('message', ({ to, from, text }) => {
    io.to(to).emit('message', { from, text });
  });

  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { candidate });
  });

  socket.on('disconnect', () => {
    users = users.filter(user => user.id !== socket.id);
    io.emit('users', users);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur sur http://localhost:${PORT}`));
