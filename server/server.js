require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const app = require('./app');
const server = http.createServer(app);
const { startQueueWorker } = require('./modules/queue/services/queue.worker');

// Initialize Socket.IO server
const { initSocket } = require('./modules/shared/socket');
initSocket(server);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  startQueueWorker();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Stop the other server process or set a different PORT in .env.`
      );
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
});
