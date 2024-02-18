const socketIO = require('socket.io');
const axios = require('axios');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');
require('dotenv').config();

const io = socketIO(process.env._PORT, {
  cors: {
    origin: ['http://localhost:5173','http://localhost:8080','http://localhost:4000','http://localhost:3000','https://dev--dev-server-projecthub.netlify.app','https://main--production-projecthub.netlify.app','https://production-projecthub.netlify.app','https://projecthub-devsprint.netlify.app','https://dev-server-projecthub.netlify.app','https://realtime-server-production-iiuvnntd4a-uw.a.run.app','https://realtime-server-iiuvnntd4a-uw.a.run.app','https://projecthub-devsprint-dev-iiuvnntd4a-uw.a.run.app','https://projecthub-devsprint-production-iiuvnntd4a-uw.a.run.app']
  }
});

const redisClient = redis.createClient({
  url: process.env._REDIS_HOST,
});
redisClient.connect().then(() => console.log("Redis client connected"));

const subClient = redisClient.duplicate();
io.adapter(createAdapter(redisClient, subClient));

const socketToRoom = {};

redisClient.on('error', err => {
  console.error('Redis client error:', err);
});

subClient.on('error', err => {
  console.error('Redis subClient error:', err);
});

subClient.subscribe('socket-room-map');

subClient.on('message', (channel, message) => {
  const { action, socketId, roomName } = JSON.parse(message);
  if (action === 'join') {
    socketToRoom[socketId] = roomName;
    console.log(`Socket ${socketId} joined room ${roomName}`);
  } else if (action === 'leave') {
    delete socketToRoom[socketId];
    console.log(`Socket ${socketId} left room ${roomName}`);
  }
});

io.on('connection', socket => {
  console.log(`Socket ${socket.id} connected`);

  socket.on('join room', roomName => {
    console.log(`${socket.id} joined room`, roomName);
    socket.join(roomName);
    socketToRoom[socket.id] = roomName;
    redisClient.publish('socket-room-map', JSON.stringify({ action: 'join', socketId: socket.id, roomName }));
  });

  socket.on('leave room', roomName => {
    socket.leave(roomName);
    delete socketToRoom[socket.id];
    redisClient.publish('socket-room-map', JSON.stringify({ action: 'leave', socketId: socket.id, roomName }));
  });

  socket.on('message', async message => {
    const roomName = socketToRoom[socket.id];
    if (roomName) {
      io.to(roomName).emit('message', message);
      console.log(`Message sent to room ${roomName}:`, message);
      try {
        await axios.post(`${process.env._PRIMARY_SERVER}/messaging/add`, {
          ...message,
          projectID: roomName
        },{
          headers: {
            xAuthToken: process.env._AUTH_TOKEN
          }
        });
      } catch (error) {
        console.log("Server Not Available");
        console.log(error);
      }
    } else {
      console.log(`Error: ${socket.id} is not in any room.`);
    }
  });

  socket.on('canvas-data', data => {
    const roomName = socketToRoom[socket.id];
    if (roomName) {
      io.to(roomName).emit('canvas-data', data);
    } else {
      console.log(`Error: ${socket.id} is not in any room.`);
    }
  });

  socket.on('disconnect', () => {
    const roomName = socketToRoom[socket.id];
    if (roomName) {
      console.log(`Socket ${socket.id} disconnected from room ${roomName}`);
      delete socketToRoom[socket.id];
    } else {
      console.log(`Socket ${socket.id} disconnected`);
    }
  });
});
