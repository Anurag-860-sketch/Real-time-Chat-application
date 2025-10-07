require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const User = require('./models/User');
const Message = require('./models/Message');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = socketIO(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Chat API is running...');
});

// Store online users
const onlineUsers = new Map();

// Socket.io Connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User joins
  socket.on('user_connected', async (userId) => {
    try {
      onlineUsers.set(userId, socket.id);
      
      // Update user online status in database
      await User.findByIdAndUpdate(userId, { 
        isOnline: true,
        lastSeen: new Date()
      });

      // Broadcast to all users that this user is online
      io.emit('user_status_changed', { 
        userId, 
        isOnline: true 
      });

      console.log(`User ${userId} connected`);
    } catch (error) {
      console.error('Error in user_connected:', error);
    }
  });

  // User is typing
  socket.on('typing', ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { userId: senderId });
    }
  });

  // User stopped typing
  socket.on('stop_typing', ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_stopped_typing', { userId: senderId });
    }
  });

  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { sender, receiver, content } = data;

      // Save message to database
      const message = await Message.create({
        sender,
        receiver,
        content
      });

      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar')
        .populate('receiver', 'username avatar');

      // Send to receiver if online
      const receiverSocketId = onlineUsers.get(receiver);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive_message', populatedMessage);
      }

      // Send back to sender for confirmation
      socket.emit('message_sent', populatedMessage);

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message_error', { message: 'Failed to send message' });
    }
  });

  // Mark message as read
  socket.on('message_read', async ({ messageId, userId }) => {
    try {
      await Message.findByIdAndUpdate(messageId, {
        isRead: true,
        readAt: new Date()
      });

      const senderSocketId = onlineUsers.get(userId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('message_read_receipt', { messageId });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });

  // User disconnects
  socket.on('disconnect', async () => {
    try {
      // Find and remove user from online users
      let disconnectedUserId = null;
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          onlineUsers.delete(userId);
          break;
        }
      }

      if (disconnectedUserId) {
        // Update user offline status in database
        await User.findByIdAndUpdate(disconnectedUserId, {
          isOnline: false,
          lastSeen: new Date()
        });

        // Broadcast to all users that this user is offline
        io.emit('user_status_changed', {
          userId: disconnectedUserId,
          isOnline: false
        });

        console.log(`User ${disconnectedUserId} disconnected`);
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});