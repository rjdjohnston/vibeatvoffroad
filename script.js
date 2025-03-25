// Wait for DOM content to be fully loaded before setting up game start handlers
document.addEventListener('DOMContentLoaded', function() {
    setupGameStart();
    createExitPortal();
    createStartPortal();
    detectMobileDevice();
});

// Detect if the user is on a mobile device
function detectMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    (window.innerWidth <= 800);
    
    if (isMobile) {
        console.log('Mobile device detected - enabling touch controls');
        window.isMobileDevice = true;
    } else {
        window.isMobileDevice = false;
    }
}

// Setup game start event handlers
function setupGameStart() {
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');
    const usernameInput = document.getElementById('username');
    const controlsInfo = document.getElementById('controls-info');
    const gameHud = document.getElementById('game-hud');
    const mobileControls = document.getElementById('mobile-controls');
    
    // Check for URL parameters (from portal redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const isFromPortal = urlParams.get('portal') === 'true';
    const urlUsername = urlParams.get('username');
    
    if (isFromPortal && urlUsername) {
        console.log(`Player arrived via portal with username: ${urlUsername}`);
        // Set the username input value
        usernameInput.value = urlUsername;
        // Save to localStorage for future sessions
        localStorage.setItem('vibeatv_username', urlUsername);
        // Auto-start the game after a short delay to ensure everything is loaded
        setTimeout(() => {
            startGame();
        }, 500);
    } else {
        // Normal flow - check localStorage for previously saved username
        const savedUsername = localStorage.getItem('vibeatv_username');
        if (savedUsername) {
            usernameInput.value = savedUsername;
        }
        
        // Focus the username input
        setTimeout(() => {
            usernameInput.focus();
        }, 500);
    }
    
    // Allow pressing Enter to start the game
    usernameInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            startGame();
        }
    });
    
    // Start button click handler
    startButton.addEventListener('click', startGame);
    
    function startGame() {
        playerName = usernameInput.value.trim();
        
        // Use a default name if none provided
        if (!playerName) {
            playerName = 'Player_' + Math.floor(Math.random() * 1000);
        } else {
            // Save the username to localStorage for future sessions
            localStorage.setItem('vibeatv_username', playerName);
        }
        
        // Hide the start screen
        startScreen.classList.add('hidden');
        
        // Show controls and HUD
        controlsInfo.classList.remove('hidden');
        gameHud.classList.remove('hidden');
        
        // Show mobile controls if on a mobile device
        if (window.isMobileDevice) {
            mobileControls.classList.remove('hidden');
            // Hide keyboard controls info on mobile
            controlsInfo.classList.add('hidden');
            setupTouchControls();
        }
        
        // Set game as started
        gameStarted = true;
        
        console.log(`Game started with player name: ${playerName}`);
        
        // Initialize multiplayer if ATV model is already loaded
        if (atvMesh) {
            initializeMultiplayer();
        }
    }
}

// Keyboard controls
const controls = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w': 
        case 'ArrowUp': 
            controls.forward = true; 
            break;
        case 's': 
        case 'ArrowDown': 
            controls.backward = true; 
            break;
        case 'a': 
        case 'ArrowLeft': 
            controls.left = true; 
            break;
        case 'd': 
        case 'ArrowRight': 
            controls.right = true; 
            break;
    }
});
document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w': 
        case 'ArrowUp': 
            controls.forward = false; 
            break;
        case 's': 
        case 'ArrowDown': 
            controls.backward = false; 
            break;
        case 'a': 
        case 'ArrowLeft': 
            controls.left = false; 
            break;
        case 'd': 
        case 'ArrowRight': 
            controls.right = false; 
            break;
    }
});

// Setup touch controls for mobile devices
function setupTouchControls() {
    const joystickThumb = document.getElementById('joystick-thumb');
    const joystickBase = document.getElementById('joystick-base');
    const acceleratorButton = document.getElementById('accelerator-button');
    const brakeButton = document.getElementById('brake-button');
    
    // Joystick variables
    let isDragging = false;
    const joystickBaseRect = joystickBase.getBoundingClientRect();
    const centerX = joystickBaseRect.width / 2;
    const centerY = joystickBaseRect.height / 2;
    const maxDistance = joystickBaseRect.width / 2 - joystickThumb.clientWidth / 2;
    
    // Touch event handlers for joystick (steering)
    joystickBase.addEventListener('touchstart', handleJoystickStart);
    joystickBase.addEventListener('touchmove', handleJoystickMove);
    joystickBase.addEventListener('touchend', handleJoystickEnd);
    document.addEventListener('touchcancel', handleJoystickEnd);
    
    // Touch event handlers for accelerator and brake buttons
    acceleratorButton.addEventListener('touchstart', (e) => { 
        e.preventDefault();
        controls.forward = true; 
        acceleratorButton.style.transform = 'scale(0.9)';
    });
    acceleratorButton.addEventListener('touchend', (e) => { 
        e.preventDefault();
        controls.forward = false; 
        acceleratorButton.style.transform = 'scale(1)';
    });
    brakeButton.addEventListener('touchstart', (e) => { 
        e.preventDefault();
        controls.backward = true; 
        brakeButton.style.transform = 'scale(0.9)';
    });
    brakeButton.addEventListener('touchend', (e) => { 
        e.preventDefault();
        controls.backward = false; 
        brakeButton.style.transform = 'scale(1)';
    });
    
    // Handle device orientation for tilt-based steering
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires permission
        const orientationButton = document.createElement('button');
        orientationButton.id = 'orientation-permission';
        orientationButton.innerText = 'Enable Tilt Steering';
        orientationButton.style.position = 'absolute';
        orientationButton.style.top = '50%';
        orientationButton.style.left = '50%';
        orientationButton.style.transform = 'translate(-50%, -50%)';
        orientationButton.style.zIndex = '1000';
        orientationButton.style.padding = '15px 25px';
        orientationButton.style.backgroundColor = 'rgba(0, 100, 200, 0.8)';
        orientationButton.style.color = 'white';
        orientationButton.style.border = 'none';
        orientationButton.style.borderRadius = '8px';
        orientationButton.style.fontSize = '16px';
        orientationButton.style.cursor = 'pointer';
        
        document.body.appendChild(orientationButton);
        
        // Improved click handler with better debugging
        orientationButton.onclick = function() {
            console.log('Tilt steering button clicked');
            // Make the button visibly change to show it registered the click
            this.style.backgroundColor = 'rgba(0, 200, 100, 0.8)';
            this.innerText = 'Requesting permission...';
            
            // Make sure we're handling the permission request in a direct response to user interaction
            try {
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        console.log('Permission response:', permissionState);
                        if (permissionState === 'granted') {
                            console.log('Device orientation permission granted');
                            window.addEventListener('deviceorientation', handleOrientation);
                            this.style.display = 'none';
                            
                            // Show confirmation message
                            const notification = document.getElementById('notifications');
                            const permissionMsg = document.createElement('div');
                            permissionMsg.className = 'notification';
                            permissionMsg.innerHTML = 'Tilt steering enabled! Tilt your device to steer.';
                            notification.appendChild(permissionMsg);
                        } else {
                            // Permission denied, but we'll still enable manual tilt mode
                            console.log('Permission denied, enabling manual tilt mode');
                            this.style.backgroundColor = 'rgba(50, 150, 200, 0.8)';
                            this.innerText = 'Use Manual Tilt';
                            
                            // Switch to manual mode on next click
                            this.onclick = function() {
                                enableManualTiltMode();
                                this.style.display = 'none';
                            };
                        }
                    })
                    .catch(error => {
                        console.error('Error requesting device orientation permission:', error);
                        // Error occurred, but we'll still enable manual tilt mode
                        this.style.backgroundColor = 'rgba(50, 150, 200, 0.8)';
                        this.innerText = 'Use Manual Tilt';
                        
                        // Switch to manual mode on next click
                        this.onclick = function() {
                            enableManualTiltMode();
                            this.style.display = 'none';
                        };
                    });
            } catch (error) {
                console.error('Exception when requesting permission:', error);
                // Exception occurred, but we'll still enable manual tilt mode
                this.style.backgroundColor = 'rgba(50, 150, 200, 0.8)';
                this.innerText = 'Use Manual Tilt';
                
                // Switch to manual mode on next click
                this.onclick = function() {
                    enableManualTiltMode();
                    this.style.display = 'none';
                };
            }
            
            return false; // Prevent any default behavior
        };
    } else if (window.DeviceOrientationEvent) {
        // Non-iOS devices (Android, etc)
        console.log('Setting up device orientation for non-iOS device');
        
        // Create a button to enable tilt on Android (some devices require user interaction)
        const orientationButton = document.createElement('button');
        orientationButton.id = 'orientation-permission';
        orientationButton.innerText = 'Enable Tilt Steering';
        orientationButton.style.position = 'absolute';
        orientationButton.style.top = '50%';
        orientationButton.style.left = '50%';
        orientationButton.style.transform = 'translate(-50%, -50%)';
        orientationButton.style.zIndex = '1000';
        orientationButton.style.padding = '15px 25px';
        orientationButton.style.backgroundColor = 'rgba(0, 100, 200, 0.8)';
        orientationButton.style.color = 'white';
        orientationButton.style.border = 'none';
        orientationButton.style.borderRadius = '8px';
        orientationButton.style.fontSize = '16px';
        orientationButton.style.cursor = 'pointer';
        
        document.body.appendChild(orientationButton);
        
        orientationButton.onclick = function() {
            // For Android and other devices, just try to add the listener on user interaction
            window.addEventListener('deviceorientation', handleOrientation);
            this.style.display = 'none';
            
            // Show confirmation
            const notification = document.getElementById('notifications');
            const permissionMsg = document.createElement('div');
            permissionMsg.className = 'notification';
            permissionMsg.innerHTML = 'Tilt steering enabled! Tilt your device to steer.';
            notification.appendChild(permissionMsg);
        };
    } else {
        console.log('Device orientation not supported on this device');
        
        // Offer manual tilt mode
        const orientationButton = document.createElement('button');
        orientationButton.id = 'orientation-permission';
        orientationButton.innerText = 'Use Manual Tilt';
        orientationButton.style.position = 'absolute';
        orientationButton.style.top = '50%';
        orientationButton.style.left = '50%';
        orientationButton.style.transform = 'translate(-50%, -50%)';
        orientationButton.style.zIndex = '1000';
        orientationButton.style.padding = '15px 25px';
        orientationButton.style.backgroundColor = 'rgba(50, 150, 200, 0.8)';
        orientationButton.style.color = 'white';
        orientationButton.style.border = 'none';
        orientationButton.style.borderRadius = '8px';
        orientationButton.style.fontSize = '16px';
        orientationButton.style.cursor = 'pointer';
        
        document.body.appendChild(orientationButton);
        
        orientationButton.onclick = function() {
            enableManualTiltMode();
            this.style.display = 'none';
        };
    }
    
    // Function to enable manual tilt mode (using joystick for tilt instead of device orientation)
    function enableManualTiltMode() {
        console.log('Enabling manual tilt mode');
        
        // Show confirmation
        const notification = document.getElementById('notifications');
        const manualMsg = document.createElement('div');
        manualMsg.className = 'notification';
        manualMsg.innerHTML = 'Manual tilt mode enabled! Use joystick for dramatic tilting.';
        notification.appendChild(manualMsg);
        
        // We'll use the existing handleJoystickMove with enhanced tilt effects
        const originalJoystickMove = handleJoystickMove;
        
        // Override joystick handler to include more dramatic tilting
        handleJoystickMove = function(e) {
            originalJoystickMove.call(this, e);
            
            // Add extra tilt effect based on joystick position
            if (atvBody && isJoystickActive) {
                const joystickTilt = joystickPosition.x / maxDistance * 2; // -2 to 2 range
                manualTiltValue = joystickTilt;
            }
        };
    }
    
    // Tilt related variables
    let tiltSensitivity = 0.7; // Increased sensitivity (0-1)
    let useDeviceOrientation = true;
    let isJoystickActive = false;
    let joystickPosition = { x: 0, y: 0 };
    let manualTiltValue = 0;
    
    // Handle device orientation for tilt-based steering
    function handleOrientation(event) {
        if (!useDeviceOrientation) return;
        
        // Get the gamma rotation (left to right tilt)
        const gamma = event.gamma;
        
        // Only apply tilt if it's significant enough
        if (Math.abs(gamma) > 5) {
            // Convert gamma (-90 to 90) to steering value
            const normalizedGamma = gamma / 45 * tiltSensitivity;
            
            if (normalizedGamma < -0.15) {
                controls.left = true;
                controls.right = false;
            } else if (normalizedGamma > 0.15) {
                controls.right = true;
                controls.left = false;
            } else {
                controls.left = false;
                controls.right = false;
            }
        } else {
            controls.left = false;
            controls.right = false;
        }
    }
    
    function handleJoystickStart(e) {
        e.preventDefault();
        isDragging = true;
        
        // Disable device orientation steering when joystick is active
        useDeviceOrientation = false;
    }
    
    function handleJoystickMove(e) {
        e.preventDefault();
        if (!isDragging) return;
        
        const touch = e.touches[0];
        const rect = joystickBase.getBoundingClientRect();
        
        // Calculate touch position relative to joystick center
        let x = touch.clientX - rect.left - centerX;
        let y = touch.clientY - rect.top - centerY;
        
        // Calculate distance from center
        const distance = Math.sqrt(x * x + y * y);
        
        // If touch is outside the max distance, normalize it
        if (distance > maxDistance) {
            x = (x / distance) * maxDistance;
            y = (y / distance) * maxDistance;
        }
        
        // Move joystick thumb
        joystickThumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        
        // Normalize x to a range of -1 to 1 for steering
        const normalizedX = x / maxDistance;
        
        // Apply some deadzone to prevent unintended steering
        if (Math.abs(normalizedX) < 0.15) {
            controls.left = false;
            controls.right = false;
        } else {
            controls.left = normalizedX < 0;
            controls.right = normalizedX > 0;
        }
        
        // Update joystick position for manual tilt mode
        joystickPosition.x = x;
        joystickPosition.y = y;
        isJoystickActive = true;
    }
    
    function handleJoystickEnd(e) {
        if (e) e.preventDefault();
        isDragging = false;
        
        // Reset joystick thumb position
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        
        // Reset steering controls
        controls.left = false;
        controls.right = false;
        
        // Re-enable device orientation steering
        setTimeout(() => {
            useDeviceOrientation = true;
        }, 100);
        
        // Reset joystick position for manual tilt mode
        joystickPosition.x = 0;
        joystickPosition.y = 0;
        isJoystickActive = false;
    }
    
    // Add touch prevention to stop browser behaviors that interfere with the game
    document.addEventListener('touchmove', function(e) {
        if (gameStarted) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Prevent zooming
    document.addEventListener('gesturestart', function(e) {
        if (gameStarted) {
            e.preventDefault();
        }
    });
    
    // Add a notification about the controls
    const notification = document.getElementById('notifications');
    const mobileControlsMsg = document.createElement('div');
    mobileControlsMsg.className = 'notification';
    mobileControlsMsg.style.animation = 'none';
    mobileControlsMsg.style.opacity = '1';
    mobileControlsMsg.innerHTML = 'Mobile controls: Use joystick to steer and buttons to accelerate/brake. Tilt device for alternative steering.';
    notification.appendChild(mobileControlsMsg);
    
    // Remove the message after 10 seconds
    setTimeout(() => {
        mobileControlsMsg.style.animation = 'fadeOut 2s forwards';
        setTimeout(() => {
            notification.removeChild(mobileControlsMsg);
        }, 2000);
    }, 10000);
}

// Game state variables
let gameStarted = false;
let playerName = '';
let startPortalBox; // Global variable for start portal collision detection
let exitPortalBox; // Global variable for exit portal collision detection

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0000ff); // Blue background (fallback)
document.body.appendChild(renderer.domElement);

// Multiplayer manager
let multiplayerManager = null;

// Flip detection variables
let isFlipped = false;
let flipStartTime = 0;
let flipTimeout = 3000; // 3 seconds in milliseconds

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -15.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 20;

// Materials
const groundMaterial = new CANNON.Material('ground');
const vehicleMaterial = new CANNON.Material('vehicle');
const assetMaterial = new CANNON.Material('asset');
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, vehicleMaterial, {
    friction: 1.0,
    restitution: 0.05
});
const assetContactMaterial = new CANNON.ContactMaterial(vehicleMaterial, assetMaterial, {
    friction: 0.8,
    restitution: 0.1
});
world.addContactMaterial(contactMaterial);
world.addContactMaterial(assetContactMaterial);

// Lighting
const ambientLight = new THREE.AmbientLight(0x505050);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

// Loaders
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new THREE.GLTFLoader();

// Track variables
let trackMesh;
let trackCollider;

// Background (Desert Image JPG)
let skybox;
textureLoader.load(
    'assets/desert_image.jpg',
    (texture) => {
        const geometry = new THREE.SphereGeometry(2000, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
            depthWrite: false
        });
        skybox = new THREE.Mesh(geometry, material);
        skybox.position.set(0, 0, 0);
        scene.add(skybox);
        // console.log('Desert skybox loaded at:', skybox.position, 'Scale:', skybox.scale);
        // console.log('Scene children after adding skybox:', scene.children.length);
    },
    () => {}, // Removed console.log from progress callback
    (error) => console.error('Skybox loading failed:', error)
);

// Load 3D Race Track Model
gltfLoader.load(
    'models/tracks/drift_race_track.glb',
    (gltf) => {
        // Add the track to the scene
        trackMesh = gltf.scene;
        
        // You may need to adjust scale based on your model
        trackMesh.scale.set(5, 5, 5);
        
        // You may need to adjust position based on your model
        trackMesh.position.set(0, -1, 0);
        
        // You may need to adjust rotation based on your model
        // trackMesh.rotation.y = Math.PI / 2;
        
        // Add to scene
        scene.add(trackMesh);
        
        // console.log('3D track model loaded successfully:', trackMesh);
        
        // Add physics for the track using a simplified approach
        createTrackPhysics(trackMesh);
        
        // Adjust ATV starting position to match the new track
        if (chassisBody) {
            chassisBody.position.set(20, 10, 20); // Increased height for safety
            chassisBody.velocity.set(0, 0, 0);
            chassisBody.angularVelocity.set(0, 0, 0);
            chassisBody.quaternion.set(0, 0, 0, 1);
        }
    },
    () => {}, // Removed console.log from progress callback
    (error) => console.error('3D track loading failed:', error)
);

// Function to create physics for the track
function createTrackPhysics(trackModel) {
    // console.log("Creating physics for track model");
    
    // First, we'll create a series of box colliders that approximate the track surface
    // This is more reliable than trying to create a trimesh from the complex geometry
    
    // Create main track body
    const trackPhysicsBody = new CANNON.Body({
        mass: 0,
        material: groundMaterial
    });
    
    // These variables will store the bounding box of the track to help us create physics
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    
    // Traverse the model to find its bounding box dimensions
    trackModel.traverse((child) => {
        if (child.isMesh && child.geometry) {
            child.geometry.computeBoundingBox();
            const boundingBox = child.geometry.boundingBox;
            
            // Transform bounding box by the mesh's world matrix
            child.updateMatrixWorld(true);
            boundingBox.applyMatrix4(child.matrixWorld);
            
            // Update min/max values
            minX = Math.min(minX, boundingBox.min.x);
            maxX = Math.max(maxX, boundingBox.max.x);
            minY = Math.min(minY, boundingBox.min.y);
            maxY = Math.max(maxY, boundingBox.max.y);
            minZ = Math.min(minZ, boundingBox.min.z);
            maxZ = Math.max(maxZ, boundingBox.max.z);
        }
    });
    
    // console.log("Track bounding box:", 
    //     "X:", minX, "to", maxX,
    //     "Y:", minY, "to", maxY,
    //     "Z:", minZ, "to", maxZ
    // );
    
    // Calculate track dimensions from the actual bounding box
    // Expand the size by a multiplier to ensure it covers the visual area
    const sizeMultiplier = 5.0; // Make the collider twice as large
    const trackWidth = (maxX - minX) / 2 * sizeMultiplier;
    const trackLength = (maxZ - minZ) / 2 * sizeMultiplier;
    const trackHeight = 1;  // Keep this relatively thin
    
    // Calculate the center position
    const centerX = (maxX + minX) / 2;
    const centerZ = (maxZ + minZ) / 2;
    const centerY = minY; // Use the bottom of the track as the y-position
    
    // Create a main platform as a base collider with the actual dimensions
    const baseShape = new CANNON.Box(new CANNON.Vec3(trackWidth, trackHeight, trackLength));
    trackPhysicsBody.addShape(baseShape);
    
    // Position the track collider at the calculated center
    trackPhysicsBody.position.set(centerX, centerY, centerZ);
    world.addBody(trackPhysicsBody);
    trackCollider = trackPhysicsBody;
    
    // console.log("Added main track collider with dimensions:", 
    //     "Width:", trackWidth * 6, 
    //     "Length:", trackLength * 6,
    //     "Position:", trackPhysicsBody.position
    // );
    
    // Create invisible walls around the track to keep the ATV from falling off
    const wallHeight = 5;
    const wallThickness = 1;
    
    // Use the expanded bounds for wall placement
    const wallX = maxX * sizeMultiplier;
    const wallZ = maxZ * sizeMultiplier;
    const negWallX = minX * sizeMultiplier;
    const negWallZ = minZ * sizeMultiplier;
    
    // North wall (Z max)
    const northWallShape = new CANNON.Box(new CANNON.Vec3(trackWidth, wallHeight, wallThickness));
    const northWallBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    northWallBody.addShape(northWallShape);
    northWallBody.position.set(centerX, centerY + wallHeight, wallZ);
    world.addBody(northWallBody);
    
    // South wall (Z min)
    const southWallShape = new CANNON.Box(new CANNON.Vec3(trackWidth, wallHeight, wallThickness));
    const southWallBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    southWallBody.addShape(southWallShape);
    southWallBody.position.set(centerX, centerY + wallHeight, negWallZ);
    world.addBody(southWallBody);
    
    // East wall (X max)
    const eastWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness, wallHeight, trackLength));
    const eastWallBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    eastWallBody.addShape(eastWallShape);
    eastWallBody.position.set(wallX, centerY + wallHeight, centerZ);
    world.addBody(eastWallBody);
    
    // West wall (X min)
    const westWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness, wallHeight, trackLength));
    const westWallBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    westWallBody.addShape(westWallShape);
    westWallBody.position.set(negWallX, centerY + wallHeight, centerZ);
    world.addBody(westWallBody);
    
    // Create a debug visual to see the physics shape
    const debugGeometry = new THREE.BoxGeometry(trackWidth * 2, trackHeight * 2, trackLength * 2);
    const debugMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000, 
        wireframe: true,
        opacity: 0.5,
        transparent: true
    });
    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
    debugMesh.position.copy(trackPhysicsBody.position);
    debugMesh.visible = false; // Hide the red track boundary
    scene.add(debugMesh);
    
    // Also add debug visualizations for the walls
    const wallMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        wireframe: true,
        opacity: 0.3,
        transparent: true
    });
    
    // North wall debug
    const northWallGeo = new THREE.BoxGeometry(trackWidth * 2, wallHeight * 2, wallThickness * 2);
    const northWallDebug = new THREE.Mesh(northWallGeo, wallMaterial);
    northWallDebug.position.copy(northWallBody.position);
    northWallDebug.visible = false; // Hide the green wall boundary
    scene.add(northWallDebug);
    
    // South wall debug
    const southWallGeo = new THREE.BoxGeometry(trackWidth * 2, wallHeight * 2, wallThickness * 2);
    const southWallDebug = new THREE.Mesh(southWallGeo, wallMaterial);
    southWallDebug.position.copy(southWallBody.position);
    southWallDebug.visible = false; // Hide the green wall boundary
    scene.add(southWallDebug);
    
    // East wall debug
    const eastWallGeo = new THREE.BoxGeometry(wallThickness * 2, wallHeight * 2, trackLength * 2);
    const eastWallDebug = new THREE.Mesh(eastWallGeo, wallMaterial);
    eastWallDebug.position.copy(eastWallBody.position);
    eastWallDebug.visible = false; // Hide the green wall boundary
    scene.add(eastWallDebug);
    
    // West wall debug
    const westWallGeo = new THREE.BoxGeometry(wallThickness * 2, wallHeight * 2, trackLength * 2);
    const westWallDebug = new THREE.Mesh(westWallGeo, wallMaterial);
    westWallDebug.position.copy(westWallBody.position);
    westWallDebug.visible = false; // Hide the green wall boundary
    scene.add(westWallDebug);
    
    // Add ramps to the track with a much simpler implementation
    function createRamp(x, z, width, height, depth, angle, axis, color) {
        // Create the physics body - position is key for a smooth transition
        const rampBody = new CANNON.Body({ mass: 0, material: groundMaterial });
        const rampShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
        
        // Calculate the vertical offset to make the edge flush with the ground
        // For x-axis rotation (north/south ramps)
        let yPos = 0;
        if (axis === 'x') {
            // If angle is negative (upward at front), we need to lower the back
            // If angle is positive (upward at back), we need to lower the front
            const edgeOffset = angle < 0 ? 
                Math.sin(Math.abs(angle)) * depth/1 : // For negative angle (north ramp)
                -Math.sin(Math.abs(angle)) * depth/1;  // For positive angle (south ramp)
            yPos = height/2 + edgeOffset;
        }
        // For z-axis rotation (east/west ramps)
        else if (axis === 'z') {
            // If angle is negative (upward at right), we need to lower the left
            // If angle is positive (upward at left), we need to lower the right
            const edgeOffset = angle < 0 ? 
                Math.sin(Math.abs(angle)) * depth/1 : // For negative angle (east ramp)
                -Math.sin(Math.abs(angle)) * depth/1;  // For positive angle (west ramp)
            yPos = height/2 + edgeOffset;
        }
        
        rampBody.addShape(rampShape);
        rampBody.position.set(x, yPos, z);
        
        // Apply rotation based on axis
        const rotationAxis = new CANNON.Vec3();
        if (axis === 'x') {
            rotationAxis.set(1, 0, 0);
        } else if (axis === 'z') {
            rotationAxis.set(0, 0, 1);
        }
        rampBody.quaternion.setFromAxisAngle(rotationAxis, angle);
        world.addBody(rampBody);
        
        // Create the visual representation
        const rampGeometry = new THREE.BoxGeometry(width, height, depth);
        const rampMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.2,
            emissive: color,
            emissiveIntensity: 0.3
        });
        const rampMesh = new THREE.Mesh(rampGeometry, rampMaterial);
        
        // Position the mesh to match the physics body
        rampMesh.position.copy(rampBody.position);
        if (axis === 'x') {
            rampMesh.rotation.x = angle;
        } else if (axis === 'z') {
            rampMesh.rotation.z = angle;
        }
        
        scene.add(rampMesh);
        
        // Add spotlight for better visibility
        const spotLight = new THREE.SpotLight(color, 1.5);
        spotLight.position.set(x, 30, z);
        spotLight.target = rampMesh;
        spotLight.angle = Math.PI / 6;
        spotLight.penumbra = 0.2;
        spotLight.distance = 100;
        scene.add(spotLight);
        
        // console.log(`Created ramp at (${x}, ${yPos}, ${z}) with rotation ${angle} on ${axis} axis`);
    }
    
    // Function for creating elevated portal ramps with custom parameters
    function createPortalRamp(x, z, width, height, depth, angle, elevation, color) {
        // Create the physics body with raised position
        const rampBody = new CANNON.Body({ mass: 0, material: groundMaterial });
        const rampShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
        
        // Position with specified elevation off the ground
        const yPos = elevation + height/2;
        rampBody.addShape(rampShape);
        rampBody.position.set(x, yPos, z);
        
        // Apply rotation on x-axis
        const rotationAxis = new CANNON.Vec3(1, 0, 0);
        rampBody.quaternion.setFromAxisAngle(rotationAxis, angle);
        world.addBody(rampBody);
        
        // Create the visual representation
        const rampGeometry = new THREE.BoxGeometry(width, height, depth);
        const rampMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.2,
            emissive: color,
            emissiveIntensity: 0.3
        });
        const rampMesh = new THREE.Mesh(rampGeometry, rampMaterial);
        
        // Position the mesh to match the physics body
        rampMesh.position.copy(rampBody.position);
        rampMesh.rotation.x = angle;
        
        scene.add(rampMesh);
        
        // Add spotlight for better visibility
        const spotLight = new THREE.SpotLight(color, 1.5);
        spotLight.position.set(x, 30, z);
        spotLight.target = rampMesh;
        spotLight.angle = Math.PI / 6;
        spotLight.penumbra = 0.2;
        spotLight.distance = 100;
        scene.add(spotLight);
        
        // console.log(`Created portal ramp at (${x}, ${yPos}, ${z}) with elevation ${elevation}, angle ${angle}`);
        
        // Return the mesh in case it's needed for reference
        return rampMesh;
    }

    // Create the four ramps - make the angles more gradual and heights lower
    // createRamp(x, z, width, height, depth, angle, axis, color)
    // North ramp (red) - more gradual approach
    createRamp(0, 680, 40, 15, 50, Math.PI/12, 'x', 0xFF0000);
    
    // East ramp (green) - more gradual approach
    createRamp(150, 220, 30, 15, 50, Math.PI/12, 'z', 0x00FF00);
    
    // South ramp (blue) - more gradual approach
    createRamp(0, -500, 40, 15, 50, Math.PI/12, 'z', 0x0000FF);
    
    // West ramp (yellow) - more gradual approach
    createRamp(-50, -50, 30, 15, 50, Math.PI/12, 'z', 0xFFFF00);

    // Portal ramp - leading up to the exit portal (purple)
    createPortalRamp(-200, -250, 45, 5, 60, Math.PI/12, 2, 0x8A2BE2); // Purple
    
    // console.log("Track physics created");
}

// Create a simple ground plane as fallback (positioned much lower as a safety net)
const fallbackGroundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
groundBody.addShape(fallbackGroundShape);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
groundBody.position.set(0, -20, 0); // Much lower as a final safety net
world.addBody(groundBody);

// ATV physics
// For chassis dimensions (width, height, length)
const chassisShape = new CANNON.Box(new CANNON.Vec3(1.5, 0.3, 2.0));  // Much wider and longer, but flatter
const chassisBody = new CANNON.Body({ mass: 150, material: vehicleMaterial }); // Higher mass for stability
// Lower center of mass by offsetting the shape downward
// For center of mass height (more negative = lower center of mass)
chassisBody.addShape(chassisShape, new CANNON.Vec3(0, -0.1, 0)); // Slight offset for center of mass
chassisBody.position.set(20, 5, 20);
chassisBody.velocity.set(0, 0, 0);
chassisBody.angularVelocity.set(0, 0, 0);
chassisBody.quaternion.set(0, 0, 0, 1);
chassisBody.linearDamping = 0.7; // Less linear damping for smoother movement
chassisBody.angularDamping = 0.02;  // Reduced to allow some tilting while still providing stability
world.addBody(chassisBody);

// Wheels physics
const wheelShape = new CANNON.Sphere(0.5);
const wheelBodies = [];
const wheelConstraints = [];
const wheelPositions = [
    new CANNON.Vec3(-1.7, -0.4, -1.8), // Front left - wider and further forward
    new CANNON.Vec3(1.7, -0.4, -1.8),  // Front right - wider and further forward
    new CANNON.Vec3(-1.7, -0.4, 1.8),  // Rear left - wider and further back
    new CANNON.Vec3(1.7, -0.4, 1.8)    // Rear right - wider and further back
];

wheelPositions.forEach((pos, index) => {
    const wheelBody = new CANNON.Body({ mass: 2, material: vehicleMaterial });
    wheelBody.addShape(wheelShape);
    wheelBody.position.copy(chassisBody.position).vadd(pos);
    wheelBody.velocity.set(0, 0, 0);
    wheelBody.angularVelocity.set(0, 0, 0);
    world.addBody(wheelBody);
    wheelBodies.push(wheelBody);

    const constraint = new CANNON.HingeConstraint(chassisBody, wheelBody, {
        pivotA: pos,
        pivotB: new CANNON.Vec3(0, 0, 0),
        axisA: new CANNON.Vec3(1, 0, 0),
        axisB: new CANNON.Vec3(1, 0, 0),
        maxForce: 1e6
    });
    world.addConstraint(constraint);
    wheelConstraints.push(constraint);
});

// Step physics once to settle ATV
world.step(1 / 60);

// Load ATV model
let atvMesh;
gltfLoader.load(
    'models/atv/scene.gltf',
    (gltf) => {
        atvMesh = gltf.scene;
        
        // Scale and position the model to match the physics body
        atvMesh.scale.set(0.1, 0.1, 0.1);
        scene.add(atvMesh);
        
        // Position will be updated in the animation loop
        atvMesh.position.copy(chassisBody.position);
        atvMesh.position.y += 1.7;
        atvMesh.quaternion.copy(chassisBody.quaternion);
        
        // console.log('ATV loaded successfully');
        
        // Initialize multiplayer after ATV is loaded
        if (gameStarted) {
            initializeMultiplayer();
        }
    },
    (progress) => console.log('Loading ATV:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('ATV loading failed:', error)
);

// Initialize multiplayer
function initializeMultiplayer() {
    if (!multiplayerManager && atvMesh && gameStarted) {
        // console.log("Initializing multiplayer with player name:", playerName);
        multiplayerManager = new MultiplayerManager(scene, chassisBody, atvMesh, playerName);
        multiplayerManager.init();
    }
}

// Load and place survival assets
gltfLoader.load(
    'assets/survival/scene.gltf',
    (gltf) => {
        // console.log('Survival GLTF loaded:', gltf);
        const assets = gltf.scene;

        const tireMesh = assets.getObjectByName('opon_Material002_0');
        const barrelMesh = assets.getObjectByName('Cylinder003_Material003_0');
        const cubeMesh = assets.getObjectByName('Cube057_DefaultMaterial_0');

        if (!tireMesh || !barrelMesh || !cubeMesh) {
            console.error('One or more meshes not found:', { tireMesh, barrelMesh, cubeMesh });
            return;
        }

        assets.traverse((node) => {
            if (node.isMesh && node.material) {
                node.material.emissive = new THREE.Color(0x202020);
                node.material.emissiveIntensity = 0.5;
                // console.log(`Material for ${node.name}:`, node.material);
            }
        });

        for (let i = 0; i < 10; i++) {
            const tireClone = tireMesh.clone();
            tireClone.position.set((Math.random() - 0.5) * 600, 0, (Math.random() - 0.5) * 600);
            tireClone.scale.set(5, 5, 5);
            if (Math.abs(tireClone.position.x) > 250 || Math.abs(tireClone.position.z) > 250) {
                scene.add(tireClone);
                const tireBody = new CANNON.Body({ mass: 0, material: assetMaterial });
                tireBody.addShape(new CANNON.Box(new CANNON.Vec3(0.37, 0.37, 0.16)));
                tireBody.position.copy(tireClone.position);
                world.addBody(tireBody);
                // console.log('Tire placed at:', tireClone.position);
            }

            const barrelClone = barrelMesh.clone();
            barrelClone.position.set((Math.random() - 0.5) * 600, 0, (Math.random() - 0.5) * 600);
            barrelClone.scale.set(5, 5, 5);
            if (Math.abs(barrelClone.position.x) > 250 || Math.abs(barrelClone.position.z) > 250) {
                scene.add(barrelClone);
                const barrelBody = new CANNON.Body({ mass: 0, material: assetMaterial });
                barrelBody.addShape(new CANNON.Box(new CANNON.Vec3(0.27, 0.27, 0.44)));
                barrelBody.position.copy(barrelClone.position);
                world.addBody(barrelBody);
                // console.log('Barrel placed at:', barrelClone.position);
            }
        }

        for (let i = 0; i < 5; i++) {
            const barrelClone = barrelMesh.clone();
            barrelClone.position.set((Math.random() - 0.5) * 300, 0, (Math.random() - 0.5) * 300);
            barrelClone.scale.set(5, 5, 5);
            const distX = Math.abs(barrelClone.position.x);
            const distZ = Math.abs(barrelClone.position.z);
            if ((distX > 125 && distX < 250) || (distZ > 125 && distZ < 250)) {
                scene.add(barrelClone);
                const barrelBody = new CANNON.Body({ mass: 0, material: assetMaterial });
                barrelBody.addShape(new CANNON.Box(new CANNON.Vec3(0.27, 0.27, 0.44)));
                barrelBody.position.copy(barrelClone.position);
                world.addBody(barrelBody);
                // console.log('Extra barrel placed near track at:', barrelClone.position);
            }
        }

        const trackAssets = [
            { mesh: tireMesh, pos: new THREE.Vector3(210, 0.1, 100), size: new CANNON.Vec3(0.37, 0.37, 0.16) },
            { mesh: barrelMesh, pos: new THREE.Vector3(250, 0.1, -100), size: new CANNON.Vec3(0.27, 0.27, 0.44) },
            { mesh: cubeMesh, pos: new THREE.Vector3(-230, 0.1, 50), size: new CANNON.Vec3(1.99, 0.79, 0.78) }
        ];
        trackAssets.forEach(asset => {
            const clone = asset.mesh.clone();
            clone.position.copy(asset.pos);
            clone.scale.set(5, 5, 5);
            scene.add(clone);
            const body = new CANNON.Body({ mass: 0, material: assetMaterial });
            body.addShape(new CANNON.Box(asset.size));
            body.position.copy(clone.position);
            world.addBody(body);
            // console.log(`${asset.mesh.name} placed on track at:`, clone.position);
        });

        // console.log('Survival assets loaded and placed');
    },
    (progress) => console.log('Loading survival assets:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('Survival assets loading failed:', error)
);

// Dust particles
const particleGeometry = new THREE.BufferGeometry();
const particleCount = 200;
const posArray = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount * 3; i++) posArray[i] = 0;
particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particleMaterial = new THREE.PointsMaterial({ color: 0x654321, size: 0.2, transparent: true, opacity: 0.8 });
const dustParticles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(dustParticles);

// Speedometer UI
const speedometer = document.createElement('div');
speedometer.style.position = 'absolute';
speedometer.style.top = '10px';
speedometer.style.left = '10px';
speedometer.style.color = 'white';
speedometer.style.fontSize = '20px';
speedometer.style.background = 'rgba(0, 0, 0, 0.5)';
speedometer.style.padding = '5px';
document.body.appendChild(speedometer);

// Camera setup
camera.position.set(0, 10, -30);
camera.lookAt(0, 0, 0);

// Animation loop
let settled = false;
let clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    vibeVerse();
    world.step(1 / 60);

    const speed = 2000; // Reduced speed
    // For turning sensitivity (lower = more stable turns)
    const turnSpeed = 1.25; // Reduced from 1.5 for more stable turning
    const localDirection = new CANNON.Vec3(0, 0, -1);
    const worldDirection = chassisBody.quaternion.vmult(localDirection);
    worldDirection.y = 0;
    worldDirection.normalize();

    // Get current velocity for lean calculations
    const currentVelocity = chassisBody.velocity.length();
    
    // Simplify force application - apply directly to center of mass
    if (controls.forward) {
        chassisBody.applyForce(worldDirection.scale(-speed * 5), chassisBody.position);
    } else if (controls.backward) {
        chassisBody.applyForce(worldDirection.scale(speed * 3), chassisBody.position); // Less power for reverse
    }

    if (controls.left) {
        // Add leaning effect when turning left at speed
        if (currentVelocity > 5) {
            // Create a force that pushes the ATV to lean into the turn
            const leanDirection = new CANNON.Vec3(-1, 0, 0); // Left lean
            const worldLeanDir = chassisBody.quaternion.vmult(leanDirection);
            worldLeanDir.y = 0;
            worldLeanDir.normalize();
            // Apply lean force - stronger at higher speeds
            const leanFactor = Math.min(currentVelocity * 25, 500);
            chassisBody.applyForce(worldLeanDir.scale(leanFactor), chassisBody.position);
        }
        chassisBody.angularVelocity.y = turnSpeed;
    } else if (controls.right) {
        // Add leaning effect when turning right at speed
        if (currentVelocity > 5) {
            // Create a force that pushes the ATV to lean into the turn
            const leanDirection = new CANNON.Vec3(1, 0, 0); // Right lean
            const worldLeanDir = chassisBody.quaternion.vmult(leanDirection);
            worldLeanDir.y = 0;
            worldLeanDir.normalize();
            // Apply lean force - stronger at higher speeds
            const leanFactor = Math.min(currentVelocity * 0.5, 500);
            chassisBody.applyForce(worldLeanDir.scale(leanFactor), chassisBody.position);
        }
        chassisBody.angularVelocity.y = -turnSpeed;
    } else {
        chassisBody.angularVelocity.y *= 0.9;
    }

    if (chassisBody.position.y <= 0.9 && !settled) {
        settled = true;
        chassisBody.linearDamping = 0.5;
        chassisBody.angularDamping = 0.5;
    }

    const maxAngular = 5;
    chassisBody.angularVelocity.x = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.x));
    chassisBody.angularVelocity.y = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.y));
    chassisBody.angularVelocity.z = Math.max(-maxAngular, Math.min(maxAngular, chassisBody.angularVelocity.z));

    if (atvMesh) {
        atvMesh.position.copy(chassisBody.position);
        atvMesh.position.y += 1.7;
        atvMesh.quaternion.copy(chassisBody.quaternion);

        // Dust particles
        const velocityMagnitude = Math.sqrt(chassisBody.velocity.x ** 2 + chassisBody.velocity.z ** 2);
        const positions = dustParticles.geometry.attributes.position.array;
        if (velocityMagnitude > 0.5) {
            for (let i = 0; i < particleCount; i++) {
                const idx = i * 3;
                if (positions[idx + 1] < -0.4 || Math.random() < 0.2) {
                    positions[idx] = atvMesh.position.x + (Math.random() - 0.5) * 4;
                    positions[idx + 1] = 0 + Math.random() * 0.4;
                    positions[idx + 2] = atvMesh.position.z + (Math.random() - 0.5) * 1;
                } else {
                    positions[idx + 1] -= 0.05;
                    positions[idx] += (Math.random() - 0.5) * 0.1;
                    positions[idx + 2] += (Math.random() - 0.5) * 0.1;
                }
            }
        } else {
            for (let i = 0; i < particleCount * 3; i += 3) {
                positions[i + 1] -= 0.1;
                if (positions[i + 1] < -0.4) positions[i + 1] = -0.4;
            }
        }
        dustParticles.geometry.attributes.position.needsUpdate = true;

        const speedDisplay = (velocityMagnitude * 3.6).toFixed(1);
        // speedometer.textContent = `Speed: ${speedDisplay} km/h`;

        const cameraOffset = new THREE.Vector3(0, 5, -10);
        const atvPosition = new THREE.Vector3().copy(atvMesh.position);
        const atvQuaternion = new THREE.Quaternion().copy(atvMesh.quaternion);
        cameraOffset.applyQuaternion(atvQuaternion);
        const targetCameraPosition = atvPosition.add(cameraOffset);
        camera.position.lerp(targetCameraPosition, 0.05);
        camera.lookAt(atvMesh.position);

        if (skybox) {
            skybox.position.copy(camera.position);
        }
        
        updateHUD();
    }

    if (chassisBody.position.y < -25 || chassisBody.position.y > 50) {
        // If the ATV falls through or flies off, reset it
        chassisBody.position.set(20, 10, 20);
        chassisBody.velocity.set(0, 0, 0);
        chassisBody.angularVelocity.set(0, 0, 0);
        chassisBody.quaternion.set(0, 0, 0, 1);
        settled = false;
        chassisBody.linearDamping = 0.9;
        chassisBody.angularDamping = 0.9;
        // console.log('ATV reset to starting position');
    }
    
    // Check if ATV is flipped upside down
    if (chassisBody) {
        // Get the up vector in world space
        const localUpVector = new CANNON.Vec3(0, 1, 0);
        const worldUpVector = chassisBody.quaternion.vmult(localUpVector);
        
        // Calculate the dot product with the world up vector (0, 1, 0)
        // If this is negative, the ATV is more upside down than right side up
        const dotProduct = worldUpVector.dot(new CANNON.Vec3(0, 1, 0));
        
        if (dotProduct < -0.5) { // -0.5 threshold indicates significantly upside down
            if (!isFlipped) {
                // ATV just flipped
                isFlipped = true;
                flipStartTime = Date.now();
                console.log('ATV flipped upside down');
            } else if (Date.now() - flipStartTime > flipTimeout) {
                // ATV has been flipped for over 3 seconds - respawn at same position
                const currentPosition = chassisBody.position.clone();
                
                // Keep the X and Z position, but reset Y to be slightly above the ground
                // Also reset orientation and velocities
                chassisBody.position.set(currentPosition.x, 5, currentPosition.z);
                chassisBody.velocity.set(0, 0, 0);
                chassisBody.angularVelocity.set(0, 0, 0);
                chassisBody.quaternion.set(0, 0, 0, 1);
                
                // Reset flip detection
                isFlipped = false;
                console.log('ATV auto-respawned due to being upside down');
                
                // Add a visible message about the respawn
                showRespawnMessage();
            }
        } else {
            // ATV is not flipped
            isFlipped = false;
        }
    }

    renderer.render(scene, camera);
    
    // Update multiplayer
    if (multiplayerManager) {
        multiplayerManager.update();
        updatePlayerListUI();
    }
}
animate();

// Update the HUD with current player stats
function updateHUD() {
    if (!gameStarted) return;
    
    const speedElement = document.getElementById('speed-value');
    const heightElement = document.getElementById('height-value');
    
    if (speedElement && heightElement) {
        // Calculate speed in km/h (from m/s)
        const velocity = new THREE.Vector3();
        velocityFromChassis(velocity);
        const speed = Math.round(velocity.length() * 3.6); // Convert m/s to km/h
        
        // Get height off ground
        const height = Math.max(0, Math.round(chassisBody.position.y - 3));
        
        // Update HUD elements
        speedElement.textContent = `${speed} km/h`;
        heightElement.textContent = `${height} m`;
    }
}

function vibeVerse() {
    // console.log("vibeVerse function called");
    if (new URLSearchParams(window.location.search).get('portal')) {
        // <check if player has entered start portal>
            setTimeout(function() {
                if (typeof atvMesh !== 'undefined' && atvMesh) {
                    const playerBox = new THREE.Box3().setFromObject(atvMesh);
                    const portalDistance = playerBox.getCenter(new THREE.Vector3()).distanceTo(startPortalBox.getCenter(new THREE.Vector3()));
                    if (portalDistance < 50) {
                        // Get ref from URL params
                        const urlParams = new URLSearchParams(window.location.search);
                        const refUrl = urlParams.get('ref');
                        if (refUrl) {
                            // Add https if not present and include query params
                            let url = refUrl;
                            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                url = 'https://' + url;
                            }
                            const currentParams = new URLSearchParams(window.location.search);
                            const newParams = new URLSearchParams();
                            for (const [key, value] of currentParams) {
                                if (key !== 'ref') { // Skip ref param since it's in the base URL
                                    newParams.append(key, value);
                                }
                            }
                            const paramString = newParams.toString();
                            window.location.href = url + (paramString ? '?' + paramString : '');
                        }
                    }
                }
            },5000);
        // </check if player has entered start portal>

    }

    // <check if player has entered exit portal>
        if (typeof atvMesh !== 'undefined' && atvMesh) {
            // console.log("ATV mesh check passed");
            const playerBox = new THREE.Box3().setFromObject(atvMesh);
            // Check if player is within 50 units of the portal
            if (typeof exitPortalBox === 'undefined') {
                console.error("exitPortalBox is undefined in vibeVerse!");
                return;
            }
            const portalCenter = exitPortalBox.getCenter(new THREE.Vector3());
            const playerCenter = playerBox.getCenter(new THREE.Vector3());
            // console.log("Player position:", playerCenter);
            // console.log("Portal position:", portalCenter);
            const portalDistance = playerCenter.distanceTo(portalCenter);
            // console.log("Distance to portal:", portalDistance);
            
            if (portalDistance < 50) {
                // console.log("Player is within 50 units of portal");
                // Calculate current speed from vehicle velocity
                const currentSpeed = Math.round(chassisBody.velocity.length());
                // console.log("Current speed:", currentSpeed);
                
                // Start loading the next page in the background
                const currentParams = new URLSearchParams(window.location.search);
                const newParams = new URLSearchParams();
                newParams.append('portal',true);
                newParams.append('username', playerName);
                newParams.append('color','white');
                newParams.append('speed',currentSpeed);

                for (const [key, value] of currentParams) {
                    newParams.append(key, value);
                }
                const paramString = newParams.toString();
                const nextPage = 'https://portal.pieter.com' + (paramString ? '?' + paramString : '');

                // Create hidden iframe to preload next page
                if (!document.getElementById('preloadFrame')) {
                    const iframe = document.createElement('iframe');
                    iframe.id = 'preloadFrame';
                    iframe.style.display = 'none';
                    iframe.src = nextPage;
                    document.body.appendChild(iframe);
                    // console.log("Preloading next page:", nextPage);
                }

                // Only redirect once actually in the portal
                if (playerBox.intersectsBox(exitPortalBox)) {
                    // console.log("Portal intersection detected! Redirecting to:", nextPage);
                    window.location.href = nextPage;
                }
            }
        }
    // </check if player has entered exit portal>
// </put this in your animate function>
}

// Helper to get velocity
function velocityFromChassis(targetVector) {
    targetVector.set(
        chassisBody.velocity.x,
        chassisBody.velocity.y,
        chassisBody.velocity.z
    );
    return targetVector;
}

// Show a temporary message about the auto-respawn
function showRespawnMessage() {
    const message = document.createElement('div');
    message.style.position = 'absolute';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.background = 'rgba(0, 0, 0, 0.7)';
    message.style.color = 'white';
    message.style.padding = '20px';
    message.style.borderRadius = '10px';
    message.style.fontSize = '24px';
    message.style.fontWeight = 'bold';
    message.style.zIndex = '1000';
    message.style.textAlign = 'center';
    message.innerHTML = 'Vehicle respawned<br><span style="font-size: 16px">Your ATV was upside down for too long</span>';
    
    document.body.appendChild(message);
    
    // Remove the message after 2 seconds
    setTimeout(() => {
        document.body.removeChild(message);
    }, 2000);
}

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create player list UI
function createPlayerListUI() {
    const playerList = document.createElement('div');
    playerList.id = 'player-list';
    playerList.style.position = 'absolute';
    playerList.style.top = '10px';
    playerList.style.right = '10px';
    playerList.style.color = 'white';
    playerList.style.background = 'rgba(0, 0, 0, 0.5)';
    playerList.style.padding = '10px';
    playerList.style.borderRadius = '5px';
    playerList.style.fontSize = '14px';
    playerList.innerHTML = '<h3 style="margin: 0 0 5px 0">Players</h3><div id="player-entries"></div>';
    document.body.appendChild(playerList);
}

// Update player list UI
function updatePlayerListUI() {
    if (!multiplayerManager) return;
    
    const playerEntries = document.getElementById('player-entries');
    if (!playerEntries) return;
    
    // Clear existing entries
    playerEntries.innerHTML = '';
    
    // Add local player entry
    const localPlayerEntry = document.createElement('div');
    localPlayerEntry.style.marginBottom = '5px';
    localPlayerEntry.innerHTML = `<span style="color: #FFFF00">You</span>`;
    playerEntries.appendChild(localPlayerEntry);
    
    // Add entries for other players
    Object.keys(multiplayerManager.players).forEach(id => {
        const playerEntry = document.createElement('div');
        playerEntry.style.marginBottom = '5px';
        
        // Get player color as hex string
        const color = '#' + multiplayerManager.players[id].color.toString(16).padStart(6, '0');
        
        playerEntry.innerHTML = `<span style="color: ${color}">Player ${id.substring(0, 4)}</span>`;
        playerEntries.appendChild(playerEntry);
    });
}

// Create exit portal
function createExitPortal() {
    // console.log("Creating exit portal");
    // Create portal group to contain all portal elements
    const exitPortalGroup = new THREE.Group();
    exitPortalGroup.position.set(-200, 25, -300);
    exitPortalGroup.rotation.x = 0.35;
    exitPortalGroup.rotation.y = 0;

    // Create portal effect
    const exitPortalGeometry = new THREE.TorusGeometry(15, 2, 16, 100);
    const exitPortalMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        transparent: true,
        opacity: 0.8
    });
    const exitPortal = new THREE.Mesh(exitPortalGeometry, exitPortalMaterial);
    exitPortalGroup.add(exitPortal);

    // Create portal inner surface
    const exitPortalInnerGeometry = new THREE.CircleGeometry(13, 32);
    const exitPortalInnerMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const exitPortalInner = new THREE.Mesh(exitPortalInnerGeometry, exitPortalInnerMaterial);
    exitPortalGroup.add(exitPortalInner);
    
    // Add portal label
    const loader = new THREE.TextureLoader();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512; // Increased width
    canvas.height = 64;
    context.fillStyle = '#00ff00';
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.fillText('VIBEVERSE PORTAL', canvas.width/2, canvas.height/2);
    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(30, 5); // Increased width
    const labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = 20;
    exitPortalGroup.add(label);

    // Create particle system for portal effect
    const exitPortalParticleCount = 1000;
    const exitPortalParticles = new THREE.BufferGeometry();
    const exitPortalPositions = new Float32Array(exitPortalParticleCount * 3);
    const exitPortalColors = new Float32Array(exitPortalParticleCount * 3);

    for (let i = 0; i < exitPortalParticleCount * 3; i += 3) {
        // Create particles in a ring around the portal
        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + (Math.random() - 0.5) * 4;
        exitPortalPositions[i] = Math.cos(angle) * radius;
        exitPortalPositions[i + 1] = Math.sin(angle) * radius;
        exitPortalPositions[i + 2] = (Math.random() - 0.5) * 4;

        // Green color with slight variation
        exitPortalColors[i] = 0;
        exitPortalColors[i + 1] = 0.8 + Math.random() * 0.2;
        exitPortalColors[i + 2] = 0;
    }

    exitPortalParticles.setAttribute('position', new THREE.BufferAttribute(exitPortalPositions, 3));
    exitPortalParticles.setAttribute('color', new THREE.BufferAttribute(exitPortalColors, 3));

    const exitPortalParticleMaterial = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.6
    });

    const exitPortalParticleSystem = new THREE.Points(exitPortalParticles, exitPortalParticleMaterial);
    exitPortalGroup.add(exitPortalParticleSystem);

    // Add full portal group to scene
    scene.add(exitPortalGroup);

    // Create portal collision box
    exitPortalBox = new THREE.Box3().setFromObject(exitPortalGroup);
    // console.log("Exit portal box created at:", exitPortalGroup.position);
    
    // Animate particles and portal and check for collision
    function animateExitPortal() {
        const positions = exitPortalParticles.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += 0.05 * Math.sin(Date.now() * 0.001 + i);
        }
        exitPortalParticles.attributes.position.needsUpdate = true;
        // Update portal shader time
        if (exitPortalInnerMaterial.uniforms && exitPortalInnerMaterial.uniforms.time) {
            exitPortalInnerMaterial.uniforms.time.value = Date.now() * 0.001;
        }

        requestAnimationFrame(animateExitPortal);
    }
    animateExitPortal();
}

// Create start portal (only when coming from another portal)
function createStartPortal() {
    // Only create start portal if coming from another portal
    if (new URLSearchParams(window.location.search).get('portal')) {
        // console.log("Creating start portal");
        // Create portal group to contain all portal elements
        const startPortalGroup = new THREE.Group();
        startPortalGroup.position.set(20, 5, 20); // Adjusted to match new ATV starting position
        startPortalGroup.rotation.x = 0.35;
        startPortalGroup.rotation.y = 0;

        // Create portal effect
        const startPortalGeometry = new THREE.TorusGeometry(15, 2, 16, 100);
        const startPortalMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        const startPortal = new THREE.Mesh(startPortalGeometry, startPortalMaterial);
        startPortalGroup.add(startPortal);
                        
        // Create portal inner surface
        const startPortalInnerGeometry = new THREE.CircleGeometry(13, 32);
        const startPortalInnerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const startPortalInner = new THREE.Mesh(startPortalInnerGeometry, startPortalInnerMaterial);
        startPortalGroup.add(startPortalInner);

        // Create particle system for portal effect
        const startPortalParticleCount = 1000;
        const startPortalParticles = new THREE.BufferGeometry();
        const startPortalPositions = new Float32Array(startPortalParticleCount * 3);
        const startPortalColors = new Float32Array(startPortalParticleCount * 3);

        for (let i = 0; i < startPortalParticleCount * 3; i += 3) {
            // Create particles in a ring around the portal
            const angle = Math.random() * Math.PI * 2;
            const radius = 15 + (Math.random() - 0.5) * 4;
            startPortalPositions[i] = Math.cos(angle) * radius;
            startPortalPositions[i + 1] = Math.sin(angle) * radius;
            startPortalPositions[i + 2] = (Math.random() - 0.5) * 4;

            // Red color with slight variation
            startPortalColors[i] = 0.8 + Math.random() * 0.2;
            startPortalColors[i + 1] = 0;
            startPortalColors[i + 2] = 0;
        }

        startPortalParticles.setAttribute('position', new THREE.BufferAttribute(startPortalPositions, 3));
        startPortalParticles.setAttribute('color', new THREE.BufferAttribute(startPortalColors, 3));

        const startPortalParticleMaterial = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6
        });

        const startPortalParticleSystem = new THREE.Points(startPortalParticles, startPortalParticleMaterial);
        startPortalGroup.add(startPortalParticleSystem);

        // Add portal group to scene
        scene.add(startPortalGroup);

        // Create portal collision box
        startPortalBox = new THREE.Box3().setFromObject(startPortalGroup);
        // console.log("Start portal box created at:", startPortalGroup.position);

        // Animate particles and portal and check for collision
        function animateStartPortal() {
            const positions = startPortalParticles.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += 0.05 * Math.sin(Date.now() * 0.001 + i);
            }
            startPortalParticles.attributes.position.needsUpdate = true;
            // Update portal shader time
            if (startPortalInnerMaterial.uniforms && startPortalInnerMaterial.uniforms.time) {
                startPortalInnerMaterial.uniforms.time.value = Date.now() * 0.001;
            }

            requestAnimationFrame(animateStartPortal);
        }
        animateStartPortal();
    }
}