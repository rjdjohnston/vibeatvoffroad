// Multiplayer handling for Vibe ATV Off-road
class MultiplayerManager {
    constructor(scene, chassisBody, vehicleMesh) {
        this.socket = null;
        this.scene = scene;
        this.localChassisBody = chassisBody;
        this.localVehicleMesh = vehicleMesh;
        this.players = {};
        this.lastUpdateTime = 0;
        this.updateInterval = 50; // Send updates every 50ms (20 times per second)
        
        // Flag to indicate if multiplayer is initialized
        this.initialized = false;
    }
    
    // Initialize connection to server
    init() {
        if (this.initialized) return;
        
        // Create socket.io connection
        this.socket = io();
        
        // Set up event handlers
        this.setupEventHandlers();
        
        this.initialized = true;
        console.log('Multiplayer system initialized');
    }
    
    // Set up all socket event handlers
    setupEventHandlers() {
        // Handle connection
        this.socket.on('connect', () => {
            console.log('Connected to server with ID: ' + this.socket.id);
        });
        
        // Handle current players data
        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach(id => {
                if (id !== this.socket.id) {
                    this.addPlayer(id, players[id]);
                }
            });
        });
        
        // Handle new player
        this.socket.on('newPlayer', (playerInfo) => {
            this.addPlayer(playerInfo.id, playerInfo);
        });
        
        // Handle player movement
        this.socket.on('playerMoved', (playerInfo) => {
            this.updatePlayerPosition(playerInfo);
        });
        
        // Handle player disconnection
        this.socket.on('playerDisconnected', (playerId) => {
            this.removePlayer(playerId);
        });
    }
    
    // Add a new player to the scene
    addPlayer(id, playerInfo) {
        if (!this.localVehicleMesh) {
            console.error("Can't add player: local vehicle mesh not available");
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
        
        // Set initial position
        playerMesh.position.copy(this.convertCannonToThree(playerInfo.position));
        
        // Set initial quaternion
        playerMesh.quaternion.set(
            playerInfo.quaternion.x,
            playerInfo.quaternion.y,
            playerInfo.quaternion.z,
            playerInfo.quaternion.w
        );
        
        // Add to scene
        this.scene.add(playerMesh);
        
        // Store player data
        this.players[id] = {
            mesh: playerMesh,
            position: playerInfo.position,
            quaternion: playerInfo.quaternion,
            velocity: playerInfo.velocity,
            lastUpdate: Date.now(),
            color: playerInfo.color
        };
        
        console.log(`Added new player: ${id}`);
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
            this.sendUpdate();
            this.lastUpdateTime = now;
        }
        
        // Interpolate other players' positions
        this.updateOtherPlayers();
    }
    
    // Send local player position update to server
    sendUpdate() {
        if (!this.socket || !this.localChassisBody) return;
        
        // Get position and rotation from physics body
        const position = this.localChassisBody.position;
        const quaternion = this.localChassisBody.quaternion;
        const velocity = this.localChassisBody.velocity;
        
        // Send to server
        this.socket.emit('playerUpdate', {
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            quaternion: {
                x: quaternion.x,
                y: quaternion.y,
                z: quaternion.z,
                w: quaternion.w
            },
            velocity: {
                x: velocity.x,
                y: velocity.y,
                z: velocity.z
            }
        });
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
}

// Export the manager
window.MultiplayerManager = MultiplayerManager;
