const { Server } = require('socket.io');

let io;

/**
 * Initialize Socket.IO server.
 * Called once from server.js when the HTTP server starts.
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // CLIENT JOINS ROOMS
    // ───────────────
    // Instead of broadcasting to everyone, clients ask to join specific "rooms".
    // A patient on the dashboard will join their own user room to get personal token updates.
    // A patient viewing a hospital page jumps into that hospital's room to see live queue pauses.
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Patient/Staff/Doctor joins their personal room
    // Events sent here: "Your token #5 was just called!"
    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`User ${userId} joined their personal room`);
      }
    });

    // 2. Client joins a specific hospital's room
    // Events sent here: "Queue for Dr. Sharma is now PAUSED" or "Queue updated"
    socket.on('join_store_room', (storeId) => {
      if (storeId) {
        socket.join(`store:${storeId}`);
        console.log(`Client joined store room: ${storeId}`);
      }
    });

    // 3. Client joins a specific doctor's queue room (optional, for ultra-fine-grained)
    socket.on('join_queue_room', (queueId) => {
      if (queueId) {
        socket.join(`queue:${queueId}`);
        console.log(`Client joined queue room: ${queueId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Get the initialized io instance to emit events from controllers.
 * Throws error if called before initSocket.
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Please call initSocket first.');
  }
  return io;
}

module.exports = { initSocket, getIO };
