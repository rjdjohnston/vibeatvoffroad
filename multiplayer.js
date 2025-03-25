// Multiplayer handling for Vibe ATV Off-road
class MultiplayerManager {
    constructor(scene, chassisBody, vehicleMesh, playerName) {
        this.socket = null;
        this.scene = scene;
        this.localChassisBody = chassisBody;
        this.localVehicleMesh = vehicleMesh;
        this.players = {};
        this.lastUpdateTime = 0;
        this.updateInterval = 50; // Send updates every 50ms (20 times per second)
        this.playerName = playerName || 'Unknown Player';
        
        // Flag to indicate if multiplayer is initialized
        this.initialized = false;
        
        // UI elements
        this.scoreboardElement = document.getElementById('scoreboard');
        this.playerListElement = document.getElementById('player-list');
        this.notificationsElement = document.getElementById('notifications');
        
        // Jump tracking
        this.jumpTracking = {
            isInAir: false,
            jumpStartTime: 0,
            jumpStartHeight: 0,
            maxHeight: 0,
            nearestRamp: null,
            lastGroundY: 0
        };
        
        // Ramp positions from server (will be populated when connected)
        this.ramps = [];
    }
    
    // Initialize connection to server
    init() {
        if (this.initialized) {
            console.warn('MultiplayerManager already initialized');
            return;
        }
        
        console.log(`Initializing multiplayer for player: "${this.playerName}"`);
        
        // Connect to server with options that support Cloudflare proxying
        const socketOptions = {
            // Support secure websockets through Cloudflare
            transports: ['websocket'],
            // Needed for Cloudflare's proxy setup
            upgrade: true,
            // Ensure reconnection works through Cloudflare
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000
        };
        
        this.socket = io(window.location.origin, socketOptions);
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Set player name right after connection
        this.socket.on('connect', () => {
            console.log(`Connected to server with ID: ${this.socket.id}`);
            
            // Ensure we send a valid player name immediately after connection
            const validName = this.playerName && typeof this.playerName === 'string' 
                ? this.playerName.trim() 
                : 'Player_' + Math.floor(Math.random() * 1000);
                
            if (!validName || validName === '') {
                this.playerName = 'Player_' + Math.floor(Math.random() * 1000);
            } else {
                this.playerName = validName;
            }
            
            console.log(`Sending player name to server: "${this.playerName}"`);
            this.socket.emit('playerName', this.playerName);
            
            // Wait a moment to ensure the server has time to process our name
            setTimeout(() => {
                // Request current player list to ensure we have the latest data
                this.socket.emit('requestPlayerList');
                
                // Show notification that we've connected
                this.showNotification(`Connected to server as ${this.playerName}`);
            }, 500);
        });
        
        this.initialized = true;
    }
    
    // Set up all socket event handlers
    setupEventHandlers() {
        // Handle connection
        this.socket.on('connect', () => {
            console.log('Connected to server with ID: ' + this.socket.id);
        });
        
        // Handle new players joining
        this.socket.on('newPlayer', (playerInfo) => {
            console.log('New player joined:', playerInfo);
            this.handleNewPlayer(playerInfo.id, playerInfo);
        });
        
        // Handle current players
        this.socket.on('currentPlayers', (players) => {
            console.log('Received current players data:', players);
            
            // Clear existing players
            for (const playerId in this.players) {
                if (playerId !== this.socket.id) {
                    this.removePlayer(playerId);
                }
            }
            
            // Add all current players
            for (const playerId in players) {
                if (playerId !== this.socket.id) {
                    this.addPlayer(playerId, players[playerId]);
                }
            }
            
            // Update scoreboard
            this.updateScoreboard(players);
            
            // Show notification about player count
            const playerCount = Object.keys(players).length;
            this.showNotification(`${playerCount} player${playerCount !== 1 ? 's' : ''} currently in game`);
        });
        
        // Handle explicit player list updates
        this.socket.on('playerListUpdate', (players) => {
            console.log('Received player list update:', players);
            
            // Update our local player list first
            for (const playerId in players) {
                if (playerId !== this.socket.id) {
                    if (!this.players[playerId]) {
                        // New player we haven't seen before
                        this.addPlayer(playerId, players[playerId]);
                    } else {
                        // Update existing player name if changed
                        if (this.players[playerId].name !== players[playerId].name) {
                            this.players[playerId].name = players[playerId].name;
                            this.updatePlayerNameDisplay(playerId, players[playerId].name);
                        }
                    }
                }
            }
            
            // Update scoreboard with fresh data
            this.updateScoreboard(players);
        });
        
        // Handle player movement
        this.socket.on('playerMoved', (playerData) => {
            if (this.players[playerData.id]) {
                // Update position data for interpolation
                const player = this.players[playerData.id];
                
                // Store previous state for interpolation
                player.prevPosition = {
                    x: player.position.x,
                    y: player.position.y,
                    z: player.position.z
                };
                
                player.prevQuaternion = {
                    x: player.quaternion.x,
                    y: player.quaternion.y,
                    z: player.quaternion.z,
                    w: player.quaternion.w
                };
                
                // Update with new data
                player.position = playerData.position;
                player.quaternion = playerData.quaternion;
                player.velocity = playerData.velocity;
                player.lastUpdate = Date.now();
                
                // Update player name if it changed
                if (playerData.name && player.name !== playerData.name) {
                    player.name = playerData.name;
                    
                    // Update the name display
                    this.updatePlayerNameDisplay(playerData.id, playerData.name);
                }
            }
        });
        
        // Handle player disconnection
        this.socket.on('playerDisconnected', (playerId) => {
            const playerName = this.players[playerId]?.name || 'A player';
            this.removePlayer(playerId);
            this.showNotification(`${playerName} left the game`);
            
            // Update scoreboard after player removed
            const allPlayers = {...this.players};
            allPlayers[this.socket.id] = { name: this.playerName, color: 0xFFFFFF }; // Add local player
            this.updateScoreboard(allPlayers);
        });
        
        // Handle player name updates
        this.socket.on('playerNameUpdate', (data) => {
            if (this.players[data.id]) {
                const oldName = this.players[data.id].name;
                this.players[data.id].name = data.name;
                this.updatePlayerNameDisplay(data.id);
                
                // Update our local playerName if this is our player
                if (data.id === this.socket.id) {
                    this.playerName = data.name;
                    
                    // Update the global playerName variable in the main script
                    if (window.playerName !== undefined) {
                        window.playerName = data.name;
                        console.log("Updated global playerName to:", data.name);
                        
                        // Re-check editor authorization if this player name is changing
                        if (window.isAuthorizedEditor !== undefined) {
                            const wasAuthorized = window.isAuthorizedEditor;
                            window.isAuthorizedEditor = (data.name === 'RJ_4_America');
                            console.log("Editor authorization updated:", window.isAuthorizedEditor);
                            
                            // Handle change from authorized to unauthorized
                            if (wasAuthorized && !window.isAuthorizedEditor) {
                                // If edit mode is on, turn it off
                                if (window.isEditMode) {
                                    window.isEditMode = false;
                                    window.showNotification('Edit mode disabled - no longer authorized', true);
                                    
                                    // Hide editor controls if they exist
                                    const controls = document.getElementById('checkpoint-controls');
                                    if (controls) {
                                        controls.style.display = 'none';
                                    }
                                }
                            }
                            
                            // If now authorized, create controls if needed
                            if (!wasAuthorized && window.isAuthorizedEditor) {
                                // If checkpoint controls don't exist yet, create them
                                if (!document.getElementById('checkpoint-controls') && window.createCheckpointControls) {
                                    window.createCheckpointControls();
                                    
                                    // Welcome message for the editor
                                    this.showNotification('Welcome RJ_4_America - Track Editor Mode Available (Press E)');
                                } else if (document.getElementById('checkpoint-controls')) {
                                    // Show existing controls
                                    document.getElementById('checkpoint-controls').style.display = 'block';
                                    this.showNotification('Editor controls activated - Press E to edit');
                                }
                            }
                        }
                    }
                }
                
                // Show notification if name changed
                if (oldName !== data.name && oldName !== 'Unknown Player' && oldName !== 'Unknown') {
                    this.showNotification(`${oldName} changed name to: "${data.name}"`);
                }
                
                // Update scoreboard with name change
                const allPlayers = {...this.players};
                allPlayers[this.socket.id] = { name: this.playerName, color: 0xFFFFFF }; // Add local player
                this.updateScoreboard(allPlayers);
            }
        });
        
        // Handle game stats
        this.socket.on('gameStats', (gameStats) => {
            // Store ramp information
            this.ramps = gameStats.ramps;
            
            console.log('Received game stats:', gameStats);
        });
        
        // Handle ramp record updates
        this.socket.on('rampRecord', (recordData) => {
            this.showNotification(`🏆 ${recordData.playerName} set a new record of ${recordData.height}m on the ${this.getRampName(recordData.rampId)}!`);
        });
        
        // Handle airtime record updates
        this.socket.on('airtimeRecord', (recordData) => {
            this.showNotification(`⏱️ ${recordData.playerName} set a new airtime record of ${recordData.airtime.toFixed(1)}s!`);
        });
    }
    
    handleNewPlayer(id, playerInfo) {
        // Add the new player if it doesn't exist already
        if (!this.players[id]) {
            this.addPlayer(id, playerInfo);
            
            // Handle player name - ensure we have a valid name
            const playerName = playerInfo.name || 'Unknown Player';
            
            // Show notification about new player
            this.showNotification(`${playerName} joined the game`);
        }
    }
    
    // Add a new player to the scene
    addPlayer(id, playerInfo) {
        if (!this.localVehicleMesh) {
            console.error("Can't add player: local vehicle mesh not available");
            return;
        }
        
        // Ensure we're not adding duplicates
        if (this.players[id]) {
            console.warn(`Player ${id} already exists, updating instead of adding`);
            this.updatePlayer(id, playerInfo);
            return;
        }
        
        // Clone the local ATV model for other players
        const playerMesh = this.localVehicleMesh.clone();
        
        // Convert hex color to THREE.js color
        const playerColor = new THREE.Color(playerInfo.color);
        
        // Apply a unique color tint to differentiate players
        playerMesh.traverse(function(object) {
            if (object.isMesh && object.material) {
                // Clone the material to avoid affecting other meshes
                if (Array.isArray(object.material)) {
                    object.material = object.material.map(mat => mat.clone());
                    object.material.forEach(mat => {
                        // Apply more distinct coloring
                        mat.color.set(playerColor);
                        mat.emissive.set(playerColor).multiplyScalar(0.4); // Stronger emissive effect
                        mat.opacity = 0.9;  // Slightly more opaque
                        if (!mat.transparent) {
                            mat.transparent = true;
                        }
                    });
                } else {
                    object.material = object.material.clone();
                    // Apply more distinct coloring
                    object.material.color.set(playerColor);
                    object.material.emissive.set(playerColor).multiplyScalar(0.4); // Stronger emissive effect
                    object.material.opacity = 0.9;  // Slightly more opaque
                    if (!object.material.transparent) {
                        object.material.transparent = true;
                    }
                }
            }
        });
        
        // Ensure we have a player name
        const playerName = playerInfo.name || `Player_${id.substring(0, 4)}`;
        console.log(`Adding player ${id} with name: "${playerName}"`);
        
        // Add name display above the player
        const nameObj = this.createPlayerNameDisplay(playerName);
        playerMesh.add(nameObj);
        
        // Set initial position
        if (playerInfo.position) {
            playerMesh.position.set(
                playerInfo.position.x,
                playerInfo.position.y,
                playerInfo.position.z
            );
        }
        
        // Add to scene
        this.scene.add(playerMesh);
        
        // Store player data
        this.players[id] = {
            id: id,
            mesh: playerMesh,
            position: playerInfo.position,
            quaternion: playerInfo.quaternion,
            velocity: playerInfo.velocity,
            lastUpdate: Date.now(),
            color: playerInfo.color,
            name: playerName
        };
        
        console.log(`Added new player: ${id}`);
    }
    
    // Create a text display for player names
    createPlayerNameDisplay(name) {
        // Ensure we have a valid name
        const displayName = name || 'Unknown Player';
        
        // Create a canvas for the name text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Clear the canvas
        context.fillStyle = 'rgba(0, 0, 0, 0.0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the name text
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Draw text outline
        context.strokeStyle = 'black';
        context.lineWidth = 4;
        context.strokeText(displayName, canvas.width / 2, canvas.height / 2);
        
        // Draw text fill
        context.fillStyle = 'white';
        context.fillText(displayName, canvas.width / 2, canvas.height / 2);
        
        // Create a texture from the canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create a sprite material with the texture
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        
        // Create a sprite with the material
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(4, 1, 1);
        sprite.position.set(0, 3, 0); // Position above the ATV
        
        return sprite;
    }
    
    // Update a player's name display
    updatePlayerNameDisplay(playerId, name) {
        if (!this.players[playerId] || !this.players[playerId].mesh) return;
        
        // Remove any existing name display
        this.players[playerId].mesh.children.forEach(child => {
            if (child.isSprite) {
                this.players[playerId].mesh.remove(child);
            }
        });
        
        // Add new name display
        const nameObj = this.createPlayerNameDisplay(name);
        this.players[playerId].mesh.add(nameObj);
    }
    
    // Update a player's position
    updatePlayerPosition(playerInfo) {
        if (this.players[playerInfo.id]) {
            const player = this.players[playerInfo.id];
            
            // Store target position and quaternion for interpolation
            player.position = playerInfo.position;
            player.quaternion = playerInfo.quaternion;
            player.velocity = playerInfo.velocity;
            player.lastUpdate = Date.now();
        }
    }
    
    // Remove a player from the scene
    removePlayer(id) {
        if (this.players[id]) {
            // Remove mesh from scene
            this.scene.remove(this.players[id].mesh);
            
            // Delete player data
            delete this.players[id];
            
            console.log(`Removed player: ${id}`);
        }
    }
    
    // Convert CANNON.Vec3 position to THREE.Vector3
    convertCannonToThree(cannonPosition) {
        return new THREE.Vector3(
            cannonPosition.x,
            cannonPosition.y,
            cannonPosition.z
        );
    }
    
    // Update all player positions
    update() {
        if (!this.initialized || !this.localChassisBody) return;
        
        const now = Date.now();
        
        // Send local player update to server at fixed intervals
        if (now - this.lastUpdateTime > this.updateInterval) {
            this.updatePosition();
            this.lastUpdateTime = now;
        }
        
        // Interpolate other players' positions
        this.updateOtherPlayers();
    }
    
    // Update position to the server
    updatePosition() {
        if (!this.socket || !this.initialized || !this.localChassisBody) return;
        
        const now = Date.now();
        
        // Track jumps
        this.trackJumps();
        
        // Send updated position to server
        this.socket.emit('playerUpdate', {
            position: {
                x: this.localChassisBody.position.x,
                y: this.localChassisBody.position.y,
                z: this.localChassisBody.position.z
            },
            quaternion: {
                x: this.localChassisBody.quaternion.x,
                y: this.localChassisBody.quaternion.y,
                z: this.localChassisBody.quaternion.z,
                w: this.localChassisBody.quaternion.w
            },
            velocity: {
                x: this.localChassisBody.velocity.x,
                y: this.localChassisBody.velocity.y,
                z: this.localChassisBody.velocity.z
            }
        });
    }
    
    // Track jumps for the local player
    trackJumps() {
        if (!this.localChassisBody) return;
        
        const currentY = this.localChassisBody.position.y;
        const velocity = this.localChassisBody.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        
        // Consider "in air" when higher than 5 units off the ground and moving fast enough
        const inAirThreshold = 5;
        const isInAir = currentY > inAirThreshold && speed > 10;
        
        if (isInAir && !this.jumpTracking.isInAir) {
            // Jump started
            this.jumpTracking.isInAir = true;
            this.jumpTracking.jumpStartTime = Date.now();
            this.jumpTracking.jumpStartHeight = currentY;
            this.jumpTracking.maxHeight = currentY;
            this.jumpTracking.nearestRamp = this.findNearestRamp();
            
            console.log('Jump started near ramp:', this.jumpTracking.nearestRamp);
        } else if (isInAir && this.jumpTracking.isInAir) {
            // During jump, track maximum height
            this.jumpTracking.maxHeight = Math.max(this.jumpTracking.maxHeight, currentY);
        } else if (!isInAir && this.jumpTracking.isInAir) {
            // Jump ended
            const airtime = (Date.now() - this.jumpTracking.jumpStartTime) / 1000; // Convert to seconds
            const jumpHeight = Math.max(0, Math.round(this.jumpTracking.maxHeight - this.jumpTracking.jumpStartHeight));
            
            // Only report significant jumps (more than 8 meters)
            if (jumpHeight >= 8 && airtime > 1.0) {
                this.reportJump(jumpHeight, airtime, this.jumpTracking.nearestRamp);
                this.showNotification(`You jumped ${jumpHeight}m high! Airtime: ${airtime.toFixed(1)}s`);
            }
            
            // Reset jump tracking
            this.jumpTracking.isInAir = false;
        }
        
        // Always update last ground Y when on the ground
        if (!isInAir) {
            this.jumpTracking.lastGroundY = currentY;
        }
    }
    
    // Find the nearest ramp to the player
    findNearestRamp() {
        if (!this.ramps || this.ramps.length === 0) return null;
        
        // Current position (x, z only - we're looking in horizontal plane)
        const playerX = this.localChassisBody.position.x;
        const playerZ = this.localChassisBody.position.z;
        
        let nearestRamp = null;
        let shortestDistance = Number.MAX_VALUE;
        
        // Find closest ramp
        for (const ramp of this.ramps) {
            const dx = playerX - ramp.position.x;
            const dz = playerZ - ramp.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestRamp = ramp.id;
            }
        }
        
        // Only consider "near" if within a certain range (20 units)
        return shortestDistance < 20 ? nearestRamp : null;
    }
    
    // Get ramp name from ID
    getRampName(rampId) {
        if (!this.ramps) return 'Unknown Ramp';
        
        const ramp = this.ramps.find(r => r.id === rampId);
        return ramp ? ramp.name : 'Unknown Ramp';
    }
    
    // Report jump to server
    reportJump(height, airtime, rampId) {
        if (!this.socket || !this.initialized) return;
        
        this.socket.emit('jumpReport', {
            height: height,
            airtime: airtime,
            rampId: rampId
        });
        
        console.log(`Reported jump: ${height}m high, ${airtime.toFixed(1)}s airtime, ramp: ${rampId || 'none'}`);
    }
    
    // Update other players based on latest data with interpolation
    updateOtherPlayers() {
        Object.keys(this.players).forEach(id => {
            const player = this.players[id];
            
            // Simple linear interpolation for smoother movement
            const targetPos = new THREE.Vector3(
                player.position.x,
                player.position.y,
                player.position.z
            );
            
            const currentPos = player.mesh.position;
            
            // Interpolate position (lerp factor can be adjusted)
            player.mesh.position.lerp(targetPos, 0.2);
            
            // Set quaternion directly
            player.mesh.quaternion.set(
                player.quaternion.x,
                player.quaternion.y,
                player.quaternion.z,
                player.quaternion.w
            );
        });
    }
    
    // Show a notification message
    showNotification(message) {
        if (!this.notificationsElement) return;
        
        console.log('Notification:', message);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Add to notifications container
        this.notificationsElement.appendChild(notification);
        
        // Auto remove after delay
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode === this.notificationsElement) {
                    this.notificationsElement.removeChild(notification);
                }
            }, 1000);
        }, 5000);
    }
    
    // Update the scoreboard with current players
    updateScoreboard(players) {
        console.log('Updating scoreboard with players:', players);
        
        // Clear current list
        this.playerListElement.innerHTML = '';
        
        // Add each player to the scoreboard
        for (const playerId in players) {
            const playerInfo = players[playerId];
            const isLocalPlayer = playerId === this.socket.id;
            
            console.log(`Adding player to scoreboard: ${playerId}`, playerInfo);
            
            // Create player entry
            const playerEntry = document.createElement('div');
            playerEntry.className = 'player-entry';
            
            // Player color indicator
            const playerColor = document.createElement('div');
            playerColor.className = 'player-color';
            const colorValue = isLocalPlayer ? '#FFFFFF' : '#' + playerInfo.color.toString(16).padStart(6, '0');
            playerColor.style.backgroundColor = colorValue;
            playerEntry.appendChild(playerColor);
            
            // Player name
            let displayName;
            if (isLocalPlayer) {
                displayName = `${this.playerName} (You)`;
            } else {
                // Make sure we're handling name correctly for other players
                if (!playerInfo.name || playerInfo.name === 'Unknown Player') {
                    console.warn(`Player ${playerId} has no name or default name:`, playerInfo);
                }
                displayName = playerInfo.name || 'Loading...';
            }
            
            const playerName = document.createElement('div');
            playerName.className = 'player-name';
            playerName.textContent = displayName;
            playerName.dataset.playerId = playerId; // Store player ID for later updates
            playerEntry.appendChild(playerName);
            
            // Add to player list
            this.playerListElement.appendChild(playerEntry);
        }
        
        // Make sure scoreboard is visible
        if (this.scoreboardElement) {
            this.scoreboardElement.classList.remove('hidden');
        }
    }
}

// Export the manager
window.MultiplayerManager = MultiplayerManager;
