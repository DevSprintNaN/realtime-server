const { Server } = require('http');
const express = require('express');
const socketIO = require('socket.io');
const axios = require('axios');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');
require('dotenv').config();

const app = express();
const server = Server(app);
const io = socketIO(server);

const redisClient = redis.createClient({
  host: process.env.REDISHOST || 'localhost',
  port: process.env.REDISPORT || '6379',
});
redisClient.connect().then(()=>console.log("Success"));

const subClient = redisClient.duplicate();
io.adapter(createAdapter(redisClient, subClient));


redisClient.on('error', err => {
  console.error('Redis client error:', err);
});

subClient.on('error', err => {
  console.error('Redis subClient error:', err);
});

const socketToRoom = {};

io.on('connection', socket => {
  console.log(`Socket ${socket.id} connected`);

  socket.on('join room', roomName => {
    console.log(`${socket.id} joined room`, roomName);
    socket.join(roomName);
    socketToRoom[socket.id] = roomName;
  });

  socket.on('leave room', roomName => {
    socket.leave(roomName);
    delete socketToRoom[socket.id];
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
            origin:"http://localhost:4000"
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
      console.log(`Canvas Data to room ${roomName}:`, data);
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

const _PORT = process.env._PORT || 4000;
server.listen(_PORT, () => {
  console.log(`Server is running on port ${_PORT}`);
});
