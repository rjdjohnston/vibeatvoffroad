/**
 * Checkpoint Manager for Vibe ATV Off-road
 * Manages checkpoints, lap times, and checkpoint editor functionality
 */
class CheckpointManager {
    constructor(options = {}) {
        this.scene = options.scene || null;
        this.camera = options.camera || null;
        this.renderer = options.renderer || null;
        this.atvBody = options.atvBody || null;
        this.atvMesh = options.atvMesh || null;
        this.playerName = options.playerName || 'Guest';
        this.world = options.world || null;
        this.isAuthorizedEditor = false;
        this.isEditMode = false;
        this.gameStarted = false;

        // Initialize arrays and objects
        this.checkpoints = [];
        this.activeCheckpoint = 0;
        this.checkpointPositions = null;
        this.lapStartTime = null;
        this.lapTimes = [];
        this.bestLapTime = Infinity; 
        this.currentLapTime = 0;
        this.trackConfigName = 'default';
        this.lapStarted = false;
        
        // Bind methods to ensure 'this' context
        this.initialize = this.initialize.bind(this);
        this.createCheckpoint = this.createCheckpoint.bind(this);
        this.createCheckpointControls = this.createCheckpointControls.bind(this);
        this.toggleEditMode = this.toggleEditMode.bind(this);
        this.updateCheckpointUI = this.updateCheckpointUI.bind(this);
        this.showNotification = this.showNotification.bind(this);
        this.showCheckpointMessage = this.showCheckpointMessage.bind(this);
        this.loadTrackConfig = this.loadTrackConfig.bind(this);
        this.cleanupCheckpoints = this.cleanupCheckpoints.bind(this);
        this.gameStart = this.gameStart.bind(this);
        this.gameEnd = this.gameEnd.bind(this);
        this.initCheckpoints = this.initCheckpoints.bind(this);
        this.createCheckpoints = this.createCheckpoints.bind(this);
        this.update = this.update.bind(this);
    }

    /**
     * Initialize the checkpoint system
     */
    initialize() {
        console.log("Initializing checkpoint system");
        
        // Determine if this user is authorized to edit checkpoints
        // Placeholder check - replace with actual authentication logic if needed
        const urlParams = new URLSearchParams(window.location.search);
        const isEditor = urlParams.get('editor') === 'true';
        const configParam = urlParams.get('trackConfig');
        console.log("URL track config parameter:", configParam);
        
        // Set authorization flag
        this.isAuthorizedEditor = isEditor;
        console.log("User is authorized editor:", this.isAuthorizedEditor);
        
        if (this.isAuthorizedEditor) {
            // Authorized editor can specify which config to load via URL
            if (configParam) {
                this.trackConfigName = configParam;
                console.log("Authorized editor loading specified config:", this.trackConfigName);
                this.loadTrackConfig(this.trackConfigName);
            } else {
                // Default to 'default' if no specific config is requested
                console.log("Authorized editor loading default config");
                this.loadTrackConfig('default');
            }
        } else {
            // Regular players always load default.json
            console.log("Regular player loading default config");
            this.loadTrackConfig('default');
        }
        
        // Don't call createCheckpoints here - it's called by loadTrackConfig
        
        // Add keyboard listener for checkpoint editing (for all players, we'll check auth inside)
        window.addEventListener('keydown', (event) => {
            console.log("Key pressed:", event.key, "isAuthorizedEditor:", this.isAuthorizedEditor, "gameStarted:", this.gameStarted);
            if (event.key.toLowerCase() === 'e' && this.gameStarted) {
                console.log("E key pressed, authorized:", this.isAuthorizedEditor);
                // Check if player is authorized to edit
                if (this.isAuthorizedEditor) {
                    this.toggleEditMode();
                }
            }
        });
        
        // Add checkpoint editor controls (only for authorized editor)
        if (this.isAuthorizedEditor) {
            console.log("Creating editor controls for authorized user");
            this.createCheckpointControls();
            
            // Welcome message for the editor
            this.showNotification('Welcome RJ_4_America - Track Editor Mode Available (Press E)');
        }
        
        // Expose key variables and functions to the window object for access from multiplayer.js
        window.playerName = this.playerName;
        window.isAuthorizedEditor = this.isAuthorizedEditor;
        window.isEditMode = this.isEditMode;
        window.createCheckpointControls = this.createCheckpointControls;
        window.showNotification = this.showNotification;
        window.toggleEditMode = this.toggleEditMode;
        
        console.log("=========== CHECKPOINT INIT COMPLETED ===========");
        return this;
    }

    /**
     * Update the checkpoint system
     */
    update() {
        // Skip if physics world or ATV body aren't available
        if (!this.world || !this.atvBody) {
            return;
        }
        
        // Skip if no checkpoints are loaded
        if (!this.checkpoints || this.checkpoints.length === 0) {
            console.warn("No checkpoints available to check against");
            return;
        }
        
        // Get ATV position 
        const atvPos = this.atvBody.position;
        
        // Check for checkpoint collisions
        const activeCP = this.checkpoints[this.activeCheckpoint];
        
        if (!activeCP) {
            console.warn(`Invalid active checkpoint index: ${this.activeCheckpoint}`);
            return;
        }
        
        if (!activeCP.passed) {
            // Get checkpoint position
            const cpPos = activeCP.position;
            
            // Calculate direct distance between ATV and checkpoint
            const dx = atvPos.x - cpPos.x;
            const dy = atvPos.y - cpPos.y;
            const dz = atvPos.z - cpPos.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            console.log(`Distance to checkpoint ${this.activeCheckpoint}: ${distance.toFixed(2)}`);
            
            // Check if ATV is inside checkpoint (using a generous collision threshold)
            if (distance < 15) {
                console.log(`Checkpoint ${this.activeCheckpoint} passed!`);
                activeCP.passed = true;
                
                // Play checkpoint sound
                if (this.checkpointSound) {
                    this.checkpointSound.currentTime = 0;
                    this.checkpointSound.play().catch(e => console.log("Error playing checkpoint sound:", e));
                }
                
                // Show checkpoint message on screen
                this.showCheckpointMessage(this.activeCheckpoint);
                
                // If this is the start/finish line and we've already passed checkpoint 1,
                // then it counts as completing a lap
                if (this.activeCheckpoint === 0 && this.lapStarted) {
                    // Calculate lap time
                    const currentTime = performance.now();
                    const lapTime = (currentTime - this.lapStartTime) / 1000;
                    
                    // Check if this is a new best lap
                    if (lapTime < this.bestLapTime || this.bestLapTime === Infinity) {
                        this.bestLapTime = lapTime;
                        this.saveBestLapTime();
                        this.showLapTimeMessage(lapTime, true);
                    } else {
                        this.showLapTimeMessage(lapTime, false);
                    }
                    
                    console.log(`Lap completed in ${lapTime.toFixed(2)}s`);
                    
                    // Reset lap timer
                    this.lapStartTime = currentTime;
                } else if (this.activeCheckpoint === 0) {
                    // Starting a new lap
                    this.lapStarted = true;
                    this.lapStartTime = performance.now();
                    console.log("Starting new lap");
                }
                
                // Move to the next checkpoint
                this.activeCheckpoint = (this.activeCheckpoint + 1) % this.checkpoints.length;
                
                // Update the UI
                this.updateCheckpointUI();
            }
        } else {
            // Reset the passed flag when ATV leaves the checkpoint
            const cpPos = activeCP.position;
            const dx = atvPos.x - cpPos.x;
            const dy = atvPos.y - cpPos.y;
            const dz = atvPos.z - cpPos.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (distance > 20) {
                activeCP.passed = false;
            }
        }
    }

    /**
     * Set game started state to true
     */
    gameStart() {
        this.gameStarted = true;
    }

    /**
     * Set game started state to false
     */
    gameEnd() {
        this.gameStarted = false;
    }

    /**
     * Initialize checkpoints from saved positions or defaults
     */
    initCheckpoints() {
        console.log("Initializing checkpoints from localStorage or defaults");
        this.loadTrackConfig('default');
    }

    /**
     * Create checkpoints based on saved positions or defaults
     */
    createCheckpoints() {
        console.log("Creating checkpoints with positions:", this.checkpointPositions);
        
        // Clean up any existing checkpoints
        this.cleanupCheckpoints();
        
        // Reset active checkpoint to 0 (start/finish)
        this.activeCheckpoint = 0;
        this.checkpoints = []; // Ensure we start with an empty array
        
        // Use saved positions or default positions
        const positions = this.checkpointPositions || [
            // Default checkpoint positions if none are saved
            { x: 0, y: 5, z: 0 },
            { x: 50, y: 5, z: 50 },
            { x: -50, y: 5, z: 50 },
            { x: -50, y: 5, z: -50 },
            { x: 50, y: 5, z: -50 }
        ];
        
        console.log("Creating checkpoints using positions:", positions);
        
        // Create checkpoints at each position
        positions.forEach((pos, index) => {
            const isStart = index === 0;
            const checkpoint = this.createCheckpoint(pos.x, pos.y, pos.z, index, isStart);
            this.checkpoints.push(checkpoint);
        });
        
        console.log(`Created ${positions.length} checkpoints, array contains ${this.checkpoints.length} items`);
        
        // Update UI to reflect new checkpoints
        this.updateCheckpointUI();
    }

    // Create a single checkpoint
    createCheckpoint(x, y, z, index, isStart) {
        console.log(`Creating checkpoint ${index} at position (${x}, ${y}, ${z})`);
        
        // Create a group to hold checkpoint objects
        const checkpointGroup = new THREE.Group();
        checkpointGroup.position.set(x, y, z);
        checkpointGroup.name = `checkpoint-${index}`;
        
        // Determine color based on checkpoint type
        let color;
        if (index === 0) {
            // Start/Finish line (green)
            color = 0x4CAF50;
        } else if (index === 1) {
            // Checkpoint 1 (blue)
            color = 0x2196F3;
        } else if (index === 2) {
            // Checkpoint 2 (orange)
            color = 0xFF9800;
        } else {
            // Checkpoint 3+ (purple)
            color = 0x9C27B0;
        }
        
        // Create a visual checkpoint marker (using TorusGeometry for a ring shape)
        const ringGeometry = new THREE.TorusGeometry(10, 1, 16, 32);
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2; // Make the ring vertical (perpendicular to ground)
        ring.castShadow = false;
        ring.receiveShadow = false;
        ring.userData.isCheckpoint = true;
        ring.userData.checkpointIndex = index;
        checkpointGroup.add(ring);
        
        // Add a directional arrow to help with movement in edit mode
        const arrowHelper = this.createArrowHelper(x, y, z, color);
        arrowHelper.visible = false; // Hidden by default, shown in edit mode
        checkpointGroup.add(arrowHelper);
        
        // Add visible checkpoint number
        const numberLabel = this.createCheckpointNumber(x, y, z, index);
        checkpointGroup.add(numberLabel);
        
        // Create collision box for the checkpoint
        const halfExtents = new CANNON.Vec3(7.5, 10, 7.5);
        const checkpointShape = new CANNON.Box(halfExtents);
        const checkpointBody = new CANNON.Body({
            mass: 0,
            position: new CANNON.Vec3(x, y, z),
            shape: checkpointShape,
            collisionFilterGroup: 4,  // checkpoint group
            collisionFilterMask: 2    // only collide with vehicle
        });
        
        // Add the checkpoint body to the physics world
        if (this.world) {
            this.world.addBody(checkpointBody);
        } else {
            console.error("Physics world not available for checkpoint creation!");
        }
        
        // Store additional checkpoint data
        const checkpoint = {
            mesh: ring,
            body: checkpointBody,
            position: { x, y, z },
            index: index,
            passed: false
        };
        
        // Add to scene
        this.scene.add(checkpointGroup);
        
        return checkpoint;
    }

    // Create a number label showing the checkpoint number
    // Create a number label for the checkpoint
    createCheckpointNumber(x, y, z, index) {
            // Create a floating number above the checkpoint
            const group = new THREE.Group();
            group.position.set(0, 15, 0); // Position relative to parent
            
            // Create text texture
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'rgba(0, 0, 0, 0)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw circle border
            ctx.beginPath();
            ctx.arc(64, 64, 60, 0, Math.PI * 2);
            ctx.lineWidth = 6;
            
            // Color based on checkpoint index
            if (index === 0) {
                ctx.strokeStyle = '#4CAF50'; // Green
                ctx.fillStyle = 'rgba(76, 175, 80, 0.3)'; // Semi-transparent green
            } else if (index === 1) {
                ctx.strokeStyle = '#2196F3'; // Blue
                ctx.fillStyle = 'rgba(33, 150, 243, 0.3)'; // Semi-transparent blue
            } else if (index === 2) {
                ctx.strokeStyle = '#FF9800'; // Orange
                ctx.fillStyle = 'rgba(255, 152, 0, 0.3)'; // Semi-transparent orange
            } else {
                ctx.strokeStyle = '#9C27B0'; // Purple
                ctx.fillStyle = 'rgba(156, 39, 176, 0.3)'; // Semi-transparent purple
            }
            
            ctx.fill();
            ctx.stroke();
            
            // Draw number
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 80px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Show the checkpoint number (start/finish is 0, display as "S")
            const displayText = index === 0 ? 'S' : index.toString();
            ctx.fillText(displayText, 64, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                depthTest: false // Make sure it's always visible
            });
            
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(10, 10, 1);
            group.add(sprite);
            
            // Animation ID to allow for cleanup
            let animationId;
            
            // Store camera reference for animation
            const camera = this.camera;
            
            // Add animation effect to make the number float up and down
            const animate = () => {
                // Small float up and down motion
                group.position.y = 15 + Math.sin(Date.now() * 0.001) * 2;
                
                // Rotate to face the camera
                if (camera) {
                    const cameraDirection = new THREE.Vector3();
                    camera.getWorldDirection(cameraDirection);
                    sprite.rotation.z = Math.atan2(cameraDirection.x, cameraDirection.z);
                }
                
                // Store animation ID for potential cancellation
                animationId = requestAnimationFrame(animate);
            };
            
            // Start animation
            animate();
            
            // Add a cleanup method to the group
            group.dispose = function() {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
                if (material) {
                    material.dispose();
                }
                if (texture) {
                    texture.dispose();
                }
            };
            
            return group;
    }
    
    /**
     * Show a notification message
     * @param {string} message - Message to display
     * @param {boolean} isError - Whether this is an error message
     * @param {number} duration - How long to display the message (ms)
     */
    showNotification(message, isError = false, duration = 3000) {
        // Get or create the notifications container
        let notifications = document.getElementById('notifications');
        if (!notifications) {
            notifications = document.createElement('div');
            notifications.id = 'notifications';
            notifications.style.position = 'absolute';
            notifications.style.top = '80px';
            notifications.style.left = '50%';
            notifications.style.transform = 'translateX(-50%)';
            notifications.style.zIndex = '1000';
            document.body.appendChild(notifications);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.backgroundColor = isError ? 'rgba(231, 76, 60, 0.8)' : 'rgba(46, 204, 113, 0.8)';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.marginBottom = '10px';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        notification.style.fontFamily = 'Arial, sans-serif';
        notification.style.fontSize = '16px';
        notification.style.transition = 'opacity 0.5s';
        notification.style.animation = 'fadeIn 0.3s';
        notification.innerHTML = message;
        
        // Add to container
        notifications.appendChild(notification);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => {
                if (notification.parentNode === notifications) {
                    notifications.removeChild(notification);
                }
            }, 500);
        }, duration);
    }

    // Create checkpoints
    createCheckpoints() {
        // Clean up any existing checkpoints
        this.cleanupCheckpoints();
        
        // Reset checkpoint tracker
        this.activeCheckpoint = 0;
        
        // Default positions or loaded positions
        const positions = this.checkpointPositions || [
            { x: 50, y: 3, z: 50 },
            { x: -50, y: 3, z: 50 },
            { x: -50, y: 3, z: -50 },
            { x: 50, y: 3, z: -50 }
        ];
        
        // Create 4 checkpoints
        for (let i = 0; i < 4; i++) {
            const checkpoint = this.createCheckpoint(
                positions[i].x, 
                positions[i].y, 
                positions[i].z, 
                i
            );
            this.checkpoints.push(checkpoint);
        }
        
        console.log('Created', this.checkpoints.length, 'checkpoints');
        
        // Update checkpoint UI
        this.updateCheckpointUI();
    }
    
    // Create a single checkpoint
    // createCheckpoint(x, y, z, index) {
    //     // Create a group to hold checkpoint objects
    //     const checkpointGroup = new THREE.Group();
    //     checkpointGroup.position.set(x, y, z);
    //     checkpointGroup.name = `checkpoint-${index}`;
        
    //     // Create a visual checkpoint marker
    //     const checkpointGeometry = new THREE.BoxGeometry(15, 20, 15);
    //     const checkpointMaterial = new THREE.MeshBasicMaterial({
    //         color: 0x00ff00,
    //         transparent: true,
    //         opacity: 0.3,
    //         wireframe: false
    //     });
        
    //     // Change color based on checkpoint type
    //     if (index === 0) {
    //         // Start/Finish line (green)
    //         checkpointMaterial.color.set(0x00ff00);
    //     } else if (index === 1) {
    //         // Checkpoint 1 (blue)
    //         checkpointMaterial.color.set(0x0088ff);
    //     } else if (index === 2) {
    //         // Checkpoint 2 (orange)
    //         checkpointMaterial.color.set(0xff8800);
    //     } else {
    //         // Checkpoint 3+ (purple)
    //         checkpointMaterial.color.set(0x8800ff);
    //     }
        
    //     const checkpointMesh = new THREE.Mesh(checkpointGeometry, checkpointMaterial);
    //     checkpointMesh.position.set(0, 0, 0);
    //     checkpointGroup.add(checkpointMesh);
        
    //     // Add numeric label
    //     const checkpointNumber = this.createCheckpointNumber(x, y, z, index);
    //     checkpointGroup.add(checkpointNumber);
        
    //     // Create collision box for the checkpoint
    //     const halfExtents = new CANNON.Vec3(7.5, 10, 7.5);
    //     const checkpointShape = new CANNON.Box(halfExtents);
    //     const checkpointBody = new CANNON.Body({
    //         mass: 0,
    //         position: new CANNON.Vec3(x, y, z),
    //         shape: checkpointShape,
    //         collisionFilterGroup: 4,  // checkpoint group
    //         collisionFilterMask: 2    // only collide with vehicle
    //     });
    //     checkpointBody.position.set(x, y, z);
        
    //     // Add reference to the THREE.js object
    //     checkpointBody.threeMesh = checkpointMesh;
        
    //     // Store the checkpoint index and reference to the body
    //     checkpointGroup.userData.index = index;
    //     checkpointGroup.userData.checkpointBody = checkpointBody;
        
    //     // Add to scene and world
    //     this.scene.add(checkpointGroup);
    //     this.world.addBody(checkpointBody);
        
    //     // Create movement helpers if in edit mode
    //     if (this.isEditMode && this.isAuthorizedEditor) {
    //         const arrowHelpers = [
    //             this.createArrowHelper(0, 0, 0, 0xff0000),  // X axis (red)
    //             this.createArrowHelper(0, 0, 0, 0x00ff00),  // Y axis (green)
    //             this.createArrowHelper(0, 0, 0, 0x0000ff)   // Z axis (blue)
    //         ];
    //         arrowHelpers.forEach(arrow => checkpointGroup.add(arrow));
    //         checkpointGroup.userData.arrowHelpers = arrowHelpers;
    //     }
        
    //     return checkpointGroup;
    // }
    
    // Create a number label for the checkpoint
    createCheckpointNumber(x, y, z, index) {
            // Create a floating number above the checkpoint
            const group = new THREE.Group();
            group.position.set(0, 15, 0); // Position relative to parent
            
            // Create text texture
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'rgba(0, 0, 0, 0)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw circle border
            ctx.beginPath();
            ctx.arc(64, 64, 60, 0, Math.PI * 2);
            ctx.lineWidth = 6;
            
            // Color based on checkpoint index
            if (index === 0) {
                ctx.strokeStyle = '#4CAF50'; // Green
                ctx.fillStyle = 'rgba(76, 175, 80, 0.3)'; // Semi-transparent green
            } else if (index === 1) {
                ctx.strokeStyle = '#2196F3'; // Blue
                ctx.fillStyle = 'rgba(33, 150, 243, 0.3)'; // Semi-transparent blue
            } else if (index === 2) {
                ctx.strokeStyle = '#FF9800'; // Orange
                ctx.fillStyle = 'rgba(255, 152, 0, 0.3)'; // Semi-transparent orange
            } else {
                ctx.strokeStyle = '#9C27B0'; // Purple
                ctx.fillStyle = 'rgba(156, 39, 176, 0.3)'; // Semi-transparent purple
            }
            
            ctx.fill();
            ctx.stroke();
            
            // Draw number
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 80px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Show the checkpoint number (start/finish is 0, display as "S")
            const displayText = index === 0 ? 'S' : index.toString();
            ctx.fillText(displayText, 64, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                depthTest: false // Make sure it's always visible
            });
            
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(10, 10, 1);
            group.add(sprite);
            
            // Animation ID to allow for cleanup
            let animationId;
            
            // Store camera reference for animation
            const camera = this.camera;
            
            // Add animation effect to make the number float up and down
            const animate = () => {
                // Small float up and down motion
                group.position.y = 15 + Math.sin(Date.now() * 0.001) * 2;
                
                // Rotate to face the camera
                if (camera) {
                    const cameraDirection = new THREE.Vector3();
                    camera.getWorldDirection(cameraDirection);
                    sprite.rotation.z = Math.atan2(cameraDirection.x, cameraDirection.z);
                }
                
                // Store animation ID for potential cancellation
                animationId = requestAnimationFrame(animate);
            };
            
            // Start animation
            animate();
            
            // Add a cleanup method to the group
            group.dispose = function() {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
                if (material) {
                    material.dispose();
                }
                if (texture) {
                    texture.dispose();
                }
            };
            
            return group;
    }
    
    /**
     * Handle checkpoint collision detection
     * @param {Object} atvMesh - ATV mesh object
     */
    checkCheckpoints(atvMesh) {
        // Safety checks
        if (!atvMesh || !this.checkpoints || this.checkpoints.length === 0 || !this.gameStarted) {
            return;
        }
        
        // Create bounding box for the ATV
        const atvBox = new THREE.Box3().setFromObject(atvMesh);
        
        // Check if the ATV is inside the active checkpoint
        const activeCP = this.checkpoints[this.activeCheckpoint];
        if (activeCP && activeCP.collider && atvBox.intersectsBox(activeCP.collider)) {
            // Player passed through the current checkpoint
            if (!activeCP.passed) {
                activeCP.passed = true;
                
                // Play sound for checkpoint
                if (typeof playSound === 'function') {
                    playSound(activeCP.index === 0 ? 'portalEnter' : 'portalExit');
                }
                
                // Show success message
                this.showCheckpointMessage(activeCP.index);
                
                // Calculate lap time if this is the start/finish checkpoint
                if (activeCP.index === 0 && this.lastCheckpointTime > 0) {
                    // Calculate lap time
                    const currentTime = performance.now();
                    this.currentLapTime = (currentTime - this.lastCheckpointTime) / 1000; // Convert to seconds
                    
                    // Update best lap time
                    if (this.currentLapTime < this.bestLapTime) {
                        this.bestLapTime = this.currentLapTime;
                        this.saveBestLapTime();
                        this.showLapTimeMessage(this.currentLapTime, true);
                    } else {
                        this.showLapTimeMessage(this.currentLapTime, false);
                    }
                    
                    console.log(`Lap completed in ${this.currentLapTime.toFixed(2)}s`);
                    
                    // Reset lap timer
                    this.lapStartTime = currentTime;
                } else if (activeCP.index === 0) {
                    // Starting a new lap
                    this.lapStarted = true;
                    this.lapStartTime = performance.now();
                    console.log("Starting new lap");
                }
                
                // Move to the next checkpoint
                this.activeCheckpoint = (this.activeCheckpoint + 1) % this.checkpoints.length;
                
                // Update the UI
                this.updateCheckpointUI();
            }
        } else {
            // Reset the passed flag when ATV leaves the checkpoint
            if (activeCP && activeCP.passed) {
                const distanceToActiveCP = atvBox.getCenter(new THREE.Vector3())
                    .distanceTo(activeCP.collider.getCenter(new THREE.Vector3()));
                    
                if (distanceToActiveCP > 20) {
                    activeCP.passed = false;
                }
            }
        }
        
        // In edit mode, allow moving checkpoints only for authorized users
        if (this.isEditMode && this.isAuthorizedEditor && chassisBody) {
            console.log("In edit mode, moving checkpoints enabled");
            // Check if a checkpoint is close enough to move
            for (let i = 0; i < this.checkpoints.length; i++) {
                const cp = this.checkpoints[i];
                const distanceToCP = atvBox.getCenter(new THREE.Vector3())
                    .distanceTo(cp.collider.getCenter(new THREE.Vector3()));
                    
                if (distanceToCP < 15) {
                    // Make this checkpoint follow the ATV position
                    if (controls.forward && !controls.backward) {
                        // Only move forward when driving forward
                        cp.mesh.position.set(
                            chassisBody.position.x,
                            Math.max(3, chassisBody.position.y), // Keep above ground
                            chassisBody.position.z
                        );
                        // Update the collider to match new position
                        this.updateCheckpointCollider(cp);
                        console.log("Moving checkpoint", i, "to", cp.mesh.position);
                    }
                    
                    // Visual indicator that checkpoint can be moved
                    cp.mesh.material.emissiveIntensity = 0.8;
                } else {
                    // Reset visual indicator
                    cp.mesh.material.emissiveIntensity = 0.3;
                }
            }
        }
    }
    
    // Show message when passing through a checkpoint
    showCheckpointMessage(checkpointIndex) {
        // For mobile, use a more compact design that's less intrusive
        const isMobile = window.isMobileDevice;
        
        const message = document.createElement('div');
        message.style.position = 'absolute';
        
        if (isMobile) {
            // Mobile styling - smaller and at the top
            message.style.top = '70px'; // Below game controls
            message.style.left = '50%';
            message.style.transform = 'translateX(-50%)';
            message.style.padding = '10px 15px';
            message.style.fontSize = '18px';
            message.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        } else {
            // Desktop styling - larger and centered
            message.style.top = '30%';
            message.style.left = '50%';
            message.style.transform = 'translate(-50%, -50%)';
            message.style.padding = '20px';
            message.style.fontSize = '24px';
        }
        
        message.style.background = 'rgba(0, 0, 0, 0.7)';
        message.style.color = '#ffffff';
        message.style.borderRadius = '10px';
        message.style.fontWeight = 'bold';
        message.style.zIndex = '1000';
        message.style.textAlign = 'center';
        
        if (checkpointIndex === 0) {
            message.innerHTML = 'START LINE';
            message.style.color = '#4CAF50'; // Green
        } else {
            message.innerHTML = `CHECKPOINT ${checkpointIndex}`;
            message.style.color = '#2196F3'; // Blue
        }
        
        document.body.appendChild(message);
        
        // Shorter display time on mobile
        const displayTime = isMobile ? 400 : 1000;
        
        // Fade out and remove
        setTimeout(() => {
            message.style.transition = 'opacity 0.5s';
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 500);
        }, displayTime);
    }
    
    // Show lap time message
    showLapTimeMessage(lapTime, isBest) {
        // For mobile, use a more compact design that's less intrusive
        const isMobile = window.isMobileDevice;
        
        const message = document.createElement('div');
        message.style.position = 'absolute';
        
        if (isMobile) {
            // Mobile styling - smaller and at the top
            message.style.top = '70px'; // Below game controls
            message.style.left = '50%';
            message.style.transform = 'translateX(-50%)';
            message.style.padding = '10px 15px';
            message.style.fontSize = '18px';
            message.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
            // Simpler content for mobile
            message.innerHTML = isBest 
                ? `NEW BEST! ${lapTime.toFixed(2)}s` 
                : `LAP: ${lapTime.toFixed(2)}s`;
        } else {
            // Desktop styling - larger and centered
            message.style.top = '40%';
            message.style.left = '50%';
            message.style.transform = 'translate(-50%, -50%)';
            message.style.padding = '20px';
            message.style.fontSize = '24px';
            message.innerHTML = `${isBest ? 'NEW BEST TIME!' : 'LAP TIME'}<br>${lapTime.toFixed(2)} seconds`;
        }
        
        message.style.background = 'rgba(0, 0, 0, 0.7)';
        message.style.color = isBest ? '#FFD700' : '#ffffff'; // Gold for best time
        message.style.borderRadius = '10px';
        message.style.fontWeight = 'bold';
        message.style.zIndex = '1000';
        message.style.textAlign = 'center';
        
        document.body.appendChild(message);
        
        // Shorter display time on mobile
        const displayTime = isMobile ? 1500 : 2000;
        
        // Fade out and remove
        setTimeout(() => {
            message.style.transition = 'opacity 0.5s';
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 500);
        }, displayTime);
    }
    
    // Update the checkpoint UI
    updateCheckpointUI() {
        const isMobile = window.isMobileDevice;
    // Create UI if it doesn't exist
    if (!document.getElementById('checkpoint-status')) {
        const checkpointStatus = document.createElement('div');
        checkpointStatus.id = 'checkpoint-status';
        checkpointStatus.style.position = 'absolute';
        if (isMobile) {
            checkpointStatus.style.top = '10px';
        } else {
            checkpointStatus.style.top = '20px';            
        }
        checkpointStatus.style.left = '180px';
        checkpointStatus.style.color = 'white';
        checkpointStatus.style.background = 'rgba(0, 0, 0, 0.5)';
        checkpointStatus.style.padding = '10px';
        checkpointStatus.style.borderRadius = '5px';
        checkpointStatus.style.fontSize = '16px';
        checkpointStatus.style.zIndex = '100';
        checkpointStatus.classList.add('checkpoint-ui', 'hidden'); // Always start with hidden class
        
        // Show if game has already started
        if (this.gameStarted) {
            checkpointStatus.classList.remove('hidden');
        }
        
        document.body.appendChild(checkpointStatus);
        
        // Create lap time display
        const lapTimeDisplay = document.createElement('div');
        lapTimeDisplay.id = 'lap-time';
        lapTimeDisplay.style.position = 'absolute';
        if (isMobile) {
            lapTimeDisplay.style.top = '10px';
        } else {
            lapTimeDisplay.style.top = '20px';            
        }
        lapTimeDisplay.style.left = '330px';
        lapTimeDisplay.style.color = 'white';
        lapTimeDisplay.style.background = 'rgba(0, 0, 0, 0.5)';
        lapTimeDisplay.style.padding = '10px';
        lapTimeDisplay.style.borderRadius = '5px';
        lapTimeDisplay.style.fontSize = '16px';
        lapTimeDisplay.style.zIndex = '100';
        lapTimeDisplay.classList.add('checkpoint-ui', 'hidden'); // Always start with hidden class
        
        // Show if game has already started
        if (this.gameStarted) {
            lapTimeDisplay.classList.remove('hidden');
        }
        
        document.body.appendChild(lapTimeDisplay);
        
        // Show checkpoint controls when game has started
        const checkpointControls = document.getElementById('checkpoint-controls');
        if (checkpointControls && this.gameStarted) {
            checkpointControls.style.display = 'block';
        }
    } else if (this.gameStarted) {
        // If game has started, ensure all checkpoint UI elements are visible
        document.querySelectorAll('.checkpoint-ui').forEach(el => {
            el.classList.remove('hidden');
        });
    }
    
    // Update checkpoint status
    const checkpointStatus = document.getElementById('checkpoint-status');
    if (checkpointStatus && this.checkpoints.length > 0) {
        checkpointStatus.innerHTML = `
            <div class="checkpoint-label">CHECKPOINTS</div>
            <div>Next: ${this.activeCheckpoint + 1} of ${this.checkpoints.length}</div>
        `;
    }
    
    // Update lap times
    const lapTimeDisplay = document.getElementById('lap-time');
    if (lapTimeDisplay) {
        lapTimeDisplay.innerHTML = `
            <div class="checkpoint-label">LAP TIMES</div>
            <div>Current: ${this.currentLapTime.toFixed(2)}s</div>
            <div>Best: ${this.bestLapTime === Infinity ? '--' : this.bestLapTime.toFixed(2) + 's'}</div>
        `;
    }
    
    // Update the checkpoint visuals
    this.checkpoints.forEach((checkpoint, index) => {
        // Only update if checkpoint mesh exists and has material
        if (checkpoint && checkpoint.mesh && checkpoint.mesh.material) {
            // Special color for active checkpoint
            if (index === this.activeCheckpoint) {
                checkpoint.mesh.material.emissiveIntensity = 0.8;
                checkpoint.mesh.material.opacity = 0.7;
            } else {
                checkpoint.mesh.material.emissiveIntensity = 0.3;
                checkpoint.mesh.material.opacity = 0.4;
            }
        }
    });
    }

    // Create checkpoint editor controls
    createCheckpointControls() {
        console.log("Creating checkpoint controls for authorized editor");
    
    // If controls already exist, just show them
    if (document.getElementById('checkpoint-controls')) {
        document.getElementById('checkpoint-controls').style.display = 'block';
        console.log("Checkpoint controls already exist, showing them");
        return;
    }
    
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'checkpoint-controls';
    controlsDiv.style.position = 'absolute';
    controlsDiv.style.top = '260px';
    controlsDiv.style.right = '20px';
    controlsDiv.style.background = 'rgba(0, 0, 0, 0.7)';
    controlsDiv.style.padding = '15px';
    controlsDiv.style.borderRadius = '10px';
    controlsDiv.style.color = 'white';
    controlsDiv.style.zIndex = '1000';
    controlsDiv.style.display = 'block'; // Show immediately for authorized editor
    controlsDiv.style.fontFamily = 'Arial, sans-serif';
    
    // Add authorized editor badge
    const editorBadge = document.createElement('div');
    editorBadge.textContent = 'TRACK EDITOR - RJ_4_America';
    editorBadge.style.backgroundColor = '#e74c3c';
    editorBadge.style.color = 'white';
    editorBadge.style.padding = '5px 10px';
    editorBadge.style.borderRadius = '3px';
    editorBadge.style.fontWeight = 'bold';
    editorBadge.style.textAlign = 'center';
    editorBadge.style.marginBottom = '15px';
    editorBadge.style.fontSize = '14px';
    controlsDiv.appendChild(editorBadge);
    
    // Add a title for the controls
    const title = document.createElement('div');
    title.textContent = 'CHECKPOINT EDITOR';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';
    title.style.marginBottom = '15px';
    title.style.fontSize = '16px';
    title.style.borderBottom = '1px solid #555';
    title.style.paddingBottom = '5px';
    controlsDiv.appendChild(title);
    
    // Editor status message
    const statusMessage = document.createElement('div');
    statusMessage.textContent = 'Editor controls active! Press E to toggle edit mode.';
    statusMessage.style.backgroundColor = 'rgba(46, 204, 113, 0.3)'; // Green bg
    statusMessage.style.padding = '10px';
    statusMessage.style.borderRadius = '5px';
    statusMessage.style.marginBottom = '15px';
    statusMessage.style.textAlign = 'center';
    statusMessage.style.fontSize = '14px';
    controlsDiv.appendChild(statusMessage);
    
    // Edit mode toggle button
    const editButton = document.createElement('button');
    editButton.textContent = 'Edit Checkpoints';
    editButton.style.display = 'block';
    editButton.style.width = '100%';
    editButton.style.marginBottom = '10px';
    editButton.style.padding = '8px 15px';
    editButton.style.borderRadius = '5px';
    editButton.style.backgroundColor = '#3498db';
    editButton.style.color = 'white';
    editButton.style.border = 'none';
    editButton.style.cursor = 'pointer';
    
    editButton.addEventListener('click', this.toggleEditMode.bind(this));
    controlsDiv.appendChild(editButton);
    
    // Save positions button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Positions';
    saveButton.style.display = 'block';
    saveButton.style.width = '100%';
    saveButton.style.marginBottom = '10px';
    saveButton.style.padding = '8px 15px';
    saveButton.style.borderRadius = '5px';
    saveButton.style.backgroundColor = '#2ecc71';
    saveButton.style.color = 'white';
    saveButton.style.border = 'none';
    saveButton.style.cursor = 'pointer';
    controlsDiv.appendChild(saveButton);
    
    // Export positions button
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export to JSON';
    exportButton.style.display = 'block';
    exportButton.style.width = '100%';
    exportButton.style.marginBottom = '10px';
    exportButton.style.padding = '8px 15px';
    exportButton.style.borderRadius = '5px';
    exportButton.style.backgroundColor = '#9b59b6';
    exportButton.style.color = 'white';
    exportButton.style.border = 'none';
    exportButton.style.cursor = 'pointer';
    controlsDiv.appendChild(exportButton);
    
    // Configuration name input
    const configNameLabel = document.createElement('div');
    configNameLabel.textContent = 'Configuration Name:';
    configNameLabel.style.marginTop = '10px';
    configNameLabel.style.marginBottom = '5px';
    configNameLabel.style.fontSize = '14px';
    controlsDiv.appendChild(configNameLabel);
    
    const configNameInput = document.createElement('input');
    configNameInput.type = 'text';
    configNameInput.id = 'config-name-input';
    configNameInput.value = this.trackConfigName;
    configNameInput.style.width = '100%';
    configNameInput.style.padding = '5px';
    configNameInput.style.marginBottom = '10px';
    configNameInput.style.borderRadius = '3px';
    configNameInput.style.border = '1px solid #aaa';
    configNameInput.style.backgroundColor = '#222';
    configNameInput.style.color = '#fff';
    controlsDiv.appendChild(configNameInput);
    
    // Reset positions button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Positions';
    resetButton.style.display = 'block';
    resetButton.style.width = '100%';
    resetButton.style.marginBottom = '15px';
    resetButton.style.padding = '8px 15px';
    resetButton.style.borderRadius = '5px';
    resetButton.style.backgroundColor = '#e74c3c';
    resetButton.style.color = 'white';
    resetButton.style.border = 'none';
    resetButton.style.cursor = 'pointer';
    controlsDiv.appendChild(resetButton);
    
    // Info text
    const infoText = document.createElement('div');
    infoText.id = 'checkpoint-info';
    infoText.style.marginTop = '10px';
    infoText.style.fontSize = '14px';
    infoText.style.padding = '5px';
    infoText.style.borderRadius = '3px';
    infoText.style.backgroundColor = 'rgba(0,0,0,0.3)';
    infoText.textContent = 'Press E to toggle editor';
    controlsDiv.appendChild(infoText);
    
    document.body.appendChild(controlsDiv);
    
    // Event handlers
    editButton.addEventListener('click', this.toggleEditMode.bind(this));
    saveButton.addEventListener('click', this.saveCheckpointPositions.bind(this));
    exportButton.addEventListener('click', this.exportCheckpointPositions.bind(this));
    resetButton.addEventListener('click', this.resetCheckpointPositions.bind(this));
    
    // Update config name when changed
    configNameInput.addEventListener('change', () => {
        this.trackConfigName = configNameInput.value || 'default';
    });
    
    // Keyboard shortcut for edit mode
    document.addEventListener('keydown', (event) => {
        if (event.key === 'e' && this.gameStarted) {
            // Check if player is authorized to edit
            if (this.isAuthorizedEditor) {
                this.toggleEditMode();
            } else {
                console.log("Edit mode denied - not RJ_4_America");
                if (window.showNotification) {
                    window.showNotification('Only RJ_4_America can edit checkpoints', true);
                }
            }
        }
    });
    
    console.log("Checkpoint editor controls created and added to the DOM");
    }
    
    // Toggle checkpoint edit mode
    toggleEditMode() {        
        console.log("========= TOGGLE EDIT MODE =========");
        console.log("Authorization check, isAuthorizedEditor:", this.isAuthorizedEditor);
        console.log("Current playerName:", this.playerName);
        console.log("Current window.playerName:", window.playerName);
        
        // Force check authorization from window to fix potential timing issues
        this.isAuthorizedEditor = (window.playerName === 'RJ_4_America');
        
        // Make sure only authorized editors can toggle edit mode
        if (!this.isAuthorizedEditor) {
            console.log("Toggle edit mode failed - not authorized");
            this.showNotification('Only RJ_4_America can edit checkpoints', true);
            return;
        }
        
        console.log("Toggle edit mode authorized, current mode:", this.isEditMode);
        this.isEditMode = !this.isEditMode;
        window.isEditMode = this.isEditMode; // Make sure window object is updated too
        console.log("New edit mode:", this.isEditMode);
        
        // Update UI
        const controlsDiv = document.getElementById('checkpoint-controls');
        const infoText = document.getElementById('checkpoint-info');
        
        if (controlsDiv) {
            console.log("Controls div exists");
        } else {
            console.log("Controls div does not exist");
        }
        
        if (infoText) {
            infoText.textContent = this.isEditMode 
                ? 'EDIT MODE: Drive near checkpoints to move them'
                : 'Press E to toggle editor';
            infoText.style.backgroundColor = this.isEditMode ? 'rgba(231, 76, 60, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        }
        
        // Update checkpoint visuals
        this.checkpoints.forEach(checkpoint => {
            // Make checkpoints more visible in edit mode
            checkpoint.mesh.material.opacity = this.isEditMode ? 0.8 : 0.4;
            // Show the helper arrows only in edit mode
            if (checkpoint.moveHelper) {
                checkpoint.moveHelper.visible = this.isEditMode;
            }
        });
        
        console.log(`Checkpoint edit mode: ${this.isEditMode ? 'ENABLED' : 'DISABLED'}`);
        
        // Show notification
        this.showNotification(this.isEditMode ? 'Checkpoint Edit Mode: ON' : 'Checkpoint Edit Mode: OFF');
        console.log("========= TOGGLE EDIT MODE COMPLETE =========");
    }
    
    // Create an arrow helper for moving checkpoints
 createArrowHelper(x, y, z, color) {
        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(x, y + 15, z); // Position above the checkpoint
        
        // Arrow pointing down to the checkpoint
        const arrowDir = new THREE.Vector3(0, -1, 0);
        const arrowOrigin = new THREE.Vector3(0, 0, 0);
        const length = 5;
        const arrowHelper = new THREE.ArrowHelper(
            arrowDir, arrowOrigin, length, color, 2, 1
        );
        arrowGroup.add(arrowHelper);
        
        // Add text label with checkpoint number
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Clear background
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw circle border
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        
        // Color based on checkpoint index
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        
        ctx.fill();
        ctx.stroke();
        
        // Draw number
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Show the checkpoint number (start/finish is 0, display as "S")
        const displayText = '#';
        ctx.fillText(displayText, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: texture });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.set(5, 5, 1);
        label.position.set(0, 2, 0);
        arrowGroup.add(label);
        
        return arrowGroup;
    }
    
    // Update checkpoint collider when its position changes
    updateCheckpointCollider(checkpoint) {
        checkpoint.collider = new THREE.Box3().setFromObject(checkpoint.mesh);
        
        // Also update the arrow helper position
        if (checkpoint.moveHelper) {
            checkpoint.moveHelper.position.x = checkpoint.mesh.position.x;
            checkpoint.moveHelper.position.y = checkpoint.mesh.position.y + 15;
            checkpoint.moveHelper.position.z = checkpoint.mesh.position.z;
        }
        
        // Update the number label position
        if (checkpoint.numberLabel) {
            checkpoint.numberLabel.position.x = checkpoint.mesh.position.x;
            checkpoint.numberLabel.position.y = checkpoint.mesh.position.y + 15;
            checkpoint.numberLabel.position.z = checkpoint.mesh.position.z;
        }
    }
    
    // Save checkpoint positions to localStorage
    saveCheckpointPositions() {
        const trackId = 'drift_race_track'; // Unique ID for the current track
        
        // Get the configuration name
        const configNameInput = document.getElementById('config-name-input');
        const configName = (configNameInput ? configNameInput.value : this.trackConfigName) || 'default';
        
        // Create the export data
        const positions = this.checkpoints.map(cp => ({
            x: cp.mesh.position.x,
            y: cp.mesh.position.y,
            z: cp.mesh.position.z
        }));
        
        const exportData = {
            trackId: trackId,
            configName: configName,
            date: new Date().toISOString(),
            positions: positions
        };
        
        // Convert to JSON and save to localStorage
        const jsonData = JSON.stringify(exportData, null, 2);
        localStorage.setItem(`checkpoints_${trackId}`, jsonData);
        this.checkpointPositions = positions;
        
        // Update UI
        const infoText = document.getElementById('checkpoint-info');
        if (infoText) {
            infoText.textContent = 'Checkpoint positions saved!';
            setTimeout(() => {
                infoText.textContent = this.isEditMode 
                    ? 'EDIT MODE: Click and drag checkpoints. Press E to exit.'
                    : 'Press E to toggle checkpoint editor';
            }, 2000);
        }
        
        console.log('Saved checkpoint positions:', positions);
    }
    
    // Reset checkpoint positions to defaults
 resetCheckpointPositions() {
        // Default positions spread around the track
        const defaultPositions = [
            { x: 50, y: 3, z: 50 },
            { x: -50, y: 3, z: 50 },
            { x: -50, y: 3, z: -50 },
            { x: 50, y: 3, z: -50 }
        ];
        
        // Update checkpoint positions
        this.checkpoints.forEach((checkpoint, index) => {
            const pos = defaultPositions[index];
            checkpoint.mesh.position.set(pos.x, pos.y, pos.z);
            this.updateCheckpointCollider(checkpoint);
        });
        
        // Update UI
        const infoText = document.getElementById('checkpoint-info');
        if (infoText) {
            infoText.textContent = 'Checkpoint positions reset!';
            setTimeout(() => {
                infoText.textContent = this.isEditMode 
                    ? 'EDIT MODE: Click and drag checkpoints. Press E to exit.'
                    : 'Press E to toggle checkpoint editor';
            }, 2000);
        }
        
        console.log('Reset checkpoint positions to defaults');
    }
    
    // Export checkpoint positions as JSON
    exportCheckpointPositions() {
        const positions = [];
        this.checkpoints.forEach(checkpoint => {
            positions.push({
                x: checkpoint.position.x,
                y: checkpoint.position.y,
                z: checkpoint.position.z
            });
        });
        
        // Create JSON data
        const jsonData = JSON.stringify(positions, null, 2);
        
        // Create a blob with the data
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        // Create a link element to download the blob
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `checkpoint_positions_${this.trackConfigName}.json`;
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup
        URL.revokeObjectURL(url);
        
        this.showNotification('Checkpoint positions exported to file');
    }
    
    // Load track configuration
    loadTrackConfig(configName = 'default') {
        this.trackConfigName = configName;
        
        // Path to the JSON config file
        const configPath = `/checkpoints/configs/${configName}.json`;
        console.log(`Trying to load checkpoint config from: ${configPath}`);
        
        // First try to load from localStorage
        try {
            const savedPositions = localStorage.getItem(`checkpointPositions_${configName}`);
            if (savedPositions) {
                this.checkpointPositions = JSON.parse(savedPositions);
                console.log(`Loaded saved checkpoint positions for track config '${configName}':`, this.checkpointPositions);
                
                // Cleanup and recreate checkpoints with loaded positions
                this.cleanupCheckpoints();
                this.createCheckpoints();
                return;
            }
        } catch (error) {
            console.error(`Error loading checkpoint positions from localStorage for '${configName}':`, error);
        }
        
        // If no saved positions found, try to load from config file
        console.log(`Attempting to load checkpoint config from file: ${configPath}`);
        
        fetch(configPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load config file ${configPath}: ${response.status} ${response.statusText}`);
                }
                console.log(`Received response from ${configPath}`);
                return response.json();
            })
            .then(data => {
                console.log(`Successfully loaded checkpoint config from ${configPath}:`, data);
                if (data && data.positions && Array.isArray(data.positions)) {
                    console.log(`Using positions from config file:`, data.positions);
                    this.checkpointPositions = data.positions;
                    
                    // Cleanup and recreate checkpoints with loaded positions
                    this.cleanupCheckpoints();
                    this.createCheckpoints();
                } else {
                    console.error(`Invalid config file format in ${configPath}`);
                    
                    // Use default positions if the file has an invalid format
                    this.checkpointPositions = null;
                    this.cleanupCheckpoints();
                    this.createCheckpoints();
                }
            })
            .catch(error => {
                console.error(`Error loading checkpoint config from ${configPath}:`, error);
                
                // Use default positions if the file couldn't be loaded
                this.checkpointPositions = null;
                this.cleanupCheckpoints();
                this.createCheckpoints();
            });
    }
    
    // Helper function to properly cleanup checkpoints
    cleanupCheckpoints() {
        if (!this.checkpoints || !Array.isArray(this.checkpoints)) return;
        
        console.log("Cleaning up checkpoints:", this.checkpoints.length);
        
        this.checkpoints.forEach(cp => {
            if (cp.mesh) {
                this.scene.remove(cp.mesh);
                if (cp.mesh.material) {
                    cp.mesh.material.dispose();
                }
                if (cp.mesh.geometry) {
                    cp.mesh.geometry.dispose();
                }
            }
            
            if (cp.moveHelper) {
                this.scene.remove(cp.moveHelper);
            }
            
            if (cp.numberLabel) {
                // Call dispose method to properly clean up animation
                if (typeof cp.numberLabel.dispose === 'function') {
                    cp.numberLabel.dispose();
                }
                this.scene.remove(cp.numberLabel);
            }
        });
        
        // Reset the array
        this.checkpoints = [];
    }

}

export default CheckpointManager;
