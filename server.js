require('dotenv').config()

const io = require('socket.io')(process.env._PORT, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'https://dev--dev-server-projecthub.netlify.app', 'https://production-projecthub.netlify.app']
    }
  });
  
  const socketToRoom = {}; 
  
  io.on('connection', (socket) => {
  
    socket.on('join room', (roomName) => {
      console.log(` ${socket.id} joined room`, roomName);
      socket.join(roomName);
      socketToRoom[socket.id] = roomName;
    });
  
    socket.on('leave room', (roomName) => {
      socket.leave(roomName);
      delete socketToRoom[socket.id]; 
    });
  
    socket.on('message', (message) => {
      const roomName = socketToRoom[socket.id];
      if (roomName) {
        io.to(roomName).emit('message', message); 
        console.log(`Message sent to room ${roomName}:`, message);
      } else {
        console.log(`Error: ${socket.id} is not in any room.`);
      }
    });
  
    socket.on('disconnect', () => {
      const roomName = socketToRoom[socket.id];
      if (roomName) {
        console.log(`Socket ${socket.id} disconnected from room ${roomName}`);
        delete socketToRoom[socket.id]; // Remove socket from room mapping when disconnecting
      } else {
        console.log(`Socket ${socket.id} disconnected`);
      }
    });
  });
  