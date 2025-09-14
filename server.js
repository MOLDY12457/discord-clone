const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
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

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connecté à MongoDB');
}).catch(err => {
  console.error('Erreur connexion MongoDB:', err);
});

// Schéma pour les messages
const messageSchema = new mongoose.Schema({
  from: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

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
      const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
      socket.emit('messages', messages);
      console.log('Messages envoyés à', socket.id, ':', messages.length);
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    }
  });

  socket.on('message', async (msg) => {
    console.log('Message général de', msg.from, ':', msg.text);
    try {
      const newMessage = new Message({ from: msg.from, text: msg.text });
      await newMessage.save();
      console.log('Message sauvegardé:', newMessage);
      io.emit('message', { from: msg.from, text: msg.text });
    } catch (err) {
      console.error('Erreur sauvegarde message:', err);
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
