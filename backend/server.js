require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Import database and models
const { initializeDatabaseFromEnv } = require('./models/index.js');

// Import routes
const usersRouter = require('./routes/users.js');
const skillsRouter = require('./routes/skills.js');
const swapsRouter = require('./routes/swaps.js');
const searchRouter = require('./routes/search.js');

// Import middleware
const { authenticateToken } = require('./middleware/auth.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from backend/public
app.use('/api/static', express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/users', usersRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/swaps', swapsRouter);
app.use('/api/search', searchRouter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const { healthCheck } = require('./models/index.js');
    const health = await healthCheck();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ...health
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  // If it's an API request, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve the appropriate HTML file
  let filePath = req.path;
  if (filePath === '/') {
    filePath = '/pages/index.html';
  } else if (!filePath.includes('.')) {
    filePath = `/pages${filePath}.html`;
  }
  
  const fullPath = path.join(__dirname, '../frontend', filePath);
  res.sendFile(fullPath, (err) => {
    if (err) {
      // If file doesn't exist, serve index.html for SPA routing
      res.sendFile(path.join(__dirname, '../frontend/pages/index.html'));
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });
  
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room: ${roomId}`);
  });
  
  socket.on('send-message', (data) => {
    socket.to(data.roomId).emit('receive-message', data);
  });
  
  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('user-typing', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabaseFromEnv();
    console.log('✅ Database initialized successfully');
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Frontend available at: http://localhost:${PORT}`);
      console.log(`🔌 API available at: http://localhost:${PORT}/api`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer();
