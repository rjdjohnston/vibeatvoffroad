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

// Store game stats
const gameStats = {
  ramps: [
    { id: 'red', name: 'Red Ramp', position: { x: 0, z: 50 }, highestJump: 0, jumpedBy: null },
    { id: 'green', name: 'Green Ramp', position: { x: 50, z: 0 }, highestJump: 0, jumpedBy: null },
    { id: 'blue', name: 'Blue Ramp', position: { x: 0, z: -50 }, highestJump: 0, jumpedBy: null },
    { id: 'yellow', name: 'Yellow Ramp', position: { x: -50, z: 0 }, highestJump: 0, jumpedBy: null }
  ],
  highestAirtime: 0,
  highestAirtimePlayer: null
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Create new player with default values
  players[socket.id] = {
    id: socket.id,
    name: 'Player_' + Math.floor(Math.random() * 1000),  // Start with a random name instead of Unknown
    position: { x: 0, y: 10, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    color: getRandomColor(),
    stats: {
      highestJump: 0,
      airtime: 0,
      jumps: 0
    }
  };
  
  console.log(`New player created with data:`, players[socket.id]);
  
  // Send the current players to the new player
  socket.emit('currentPlayers', players);
  
  // Send game stats to new player
  socket.emit('gameStats', gameStats);
  
  // Broadcast the new player to all other players
  socket.broadcast.emit('newPlayer', players[socket.id]);
  
  // Handle explicit requests for player list
  socket.on('requestPlayerList', () => {
    console.log(`Player ${socket.id} requested current player list`);
    socket.emit('playerListUpdate', players);
  });
  
  // Handle player name updates
  socket.on('playerName', (name) => {
    if (players[socket.id]) {
      console.log(`Player ${socket.id} set name to: "${name}"`);
      
      // Store previous name for notification
      const oldName = players[socket.id].name;
      
      // Update player name - ensure it's a string and trim it
      const validName = name && typeof name === 'string' ? name.trim() : null;
      const finalName = validName || 'Player_' + Math.floor(Math.random() * 1000);
      players[socket.id].name = finalName;
      
      console.log(`Player ${socket.id} name updated to: "${players[socket.id].name}"`);
      
      // Notify all players of the name change (if it's not the initial setting)
      if (oldName !== finalName && oldName !== 'Unknown Player') {
        io.emit('playerNameChanged', {
          id: socket.id,
          oldName: oldName,
          newName: finalName
        });
      }
      
      // Send updated player list to all clients
      io.emit('playerListUpdate', players);
    }
  });
  
  // Handle player movement updates
  socket.on('playerUpdate', (data) => {
    if (players[socket.id]) {
      // Update player data
      players[socket.id].position = data.position;
      players[socket.id].quaternion = data.quaternion;
      players[socket.id].velocity = data.velocity;
      
      // Broadcast to all other players
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position: data.position,
        quaternion: data.quaternion,
        velocity: data.velocity,
        name: players[socket.id].name // Include name in movement updates for new connections
      });
    }
  });
  
  // Handle jump reporting
  socket.on('jumpReport', (jumpData) => {
    if (players[socket.id]) {
      const player = players[socket.id];
      
      // Update player's personal stats
      if (jumpData.height > player.stats.highestJump) {
        player.stats.highestJump = jumpData.height;
      }
      
      player.stats.jumps++;
      
      // Check if this is the highest jump for this ramp
      if (jumpData.rampId) {
        const ramp = gameStats.ramps.find(r => r.id === jumpData.rampId);
        if (ramp && jumpData.height > ramp.highestJump) {
          ramp.highestJump = jumpData.height;
          ramp.jumpedBy = socket.id;
          
          // Broadcast new ramp record
          io.emit('rampRecord', {
            rampId: jumpData.rampId,
            height: jumpData.height,
            playerName: player.name
          });
        }
      }
      
      // Check if this is the longest airtime
      if (jumpData.airtime > gameStats.highestAirtime) {
        gameStats.highestAirtime = jumpData.airtime;
        gameStats.highestAirtimePlayer = socket.id;
        
        // Broadcast new airtime record
        io.emit('airtimeRecord', {
          airtime: jumpData.airtime,
          playerName: player.name
        });
      }
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
