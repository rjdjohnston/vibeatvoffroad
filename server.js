const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store connected players
const players = {};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Create new player
  players[socket.id] = {
    id: socket.id,
    position: { x: 0, y: 10, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    color: getRandomColor()
  };
  
  // Send the current players to the new player
  socket.emit('currentPlayers', players);
  
  // Broadcast the new player to all other players
  socket.broadcast.emit('newPlayer', players[socket.id]);
  
  // Handle player movement updates
  socket.on('playerUpdate', (playerData) => {
    // Update player data
    if (players[socket.id]) {
      players[socket.id].position = playerData.position;
      players[socket.id].quaternion = playerData.quaternion;
      players[socket.id].velocity = playerData.velocity;
      
      // Broadcast the updated player data to all other players
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Remove player from players object
    delete players[socket.id];
    
    // Broadcast player disconnection to all other players
    io.emit('playerDisconnected', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Helper function to generate random color for players
function getRandomColor() {
  const colors = [
    0xFF5733, // Coral
    0x33FF57, // Lime Green
    0x3357FF, // Royal Blue
    0xF3FF33, // Yellow
    0xFF33F3, // Magenta
    0x33FFF3, // Cyan
    0xFF3366, // Pink
    0x9933FF, // Purple
    0xFF9933, // Orange
    0x33FF99, // Mint
    0x3399FF, // Sky Blue
    0xFFFF66  // Light Yellow
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
