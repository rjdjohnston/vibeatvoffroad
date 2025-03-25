// Add hidden class for game UI elements
const style = document.createElement('style');
style.textContent = `
.hidden {
    display: none !important;
}
.checkpoint-ui {
    /* Don't set display: none here - we'll control visibility via the hidden class */
    transition: opacity 0.3s ease-in-out;
}
`;
document.head.appendChild(style);

// Initialize the audio system
let audioSystem = {
    sounds: {},
    bgMusic: null,
    engineSound: null,
    isMuted: false,
    loaded: false
};

// Wait for DOM content to be fully loaded before setting up game start handlers
document.addEventListener('DOMContentLoaded', function() {
    setupGameStart();
    createExitPortal();
    createStartPortal();
    detectMobileDevice();
    initAudio();
});

// Initialize audio system
function initAudio() {
    // Initialize sounds object
    audioSystem.sounds = {};
    
    // Create loader function with better error handling
    const loadAudio = (url, callback) => {
        try {
            const audio = new Audio();
            
            // Set up event listeners
            audio.addEventListener('canplaythrough', () => {
                console.log(`Audio loaded: ${url}`);
                if (callback) callback(audio);
            }, { once: true });
            
            audio.addEventListener('error', (err) => {
                console.warn(`Error loading audio file ${url}:`, err);
                if (callback) callback(null); // Pass null to indicate failure
            });
            
            // Set source and load
            audio.src = url;
            audio.load();
            return audio;
        } catch (e) {
            console.error(`Exception creating audio for ${url}:`, e);
            if (callback) callback(null);
            return null;
        }
    };
    
    // Track loading progress
    let soundsToLoad = 8; // Increased from 6 to 8 for portal sounds
    let soundsLoaded = 0;
    
    const onSoundLoad = (sound) => {
        soundsLoaded++;
        console.log(`Sound loaded: ${soundsLoaded}/${soundsToLoad}`);
        
        if (soundsLoaded >= soundsToLoad) {
            audioSystem.loaded = true;
            console.log('All audio files loaded successfully');
        }
    };
    
    // Wrap in try-catch to prevent any initialization errors
    try {
        // Create audio elements
        audioSystem.bgMusic = loadAudio('sounds/background-music.mp3', onSoundLoad);
        if (audioSystem.bgMusic) {
            audioSystem.bgMusic.loop = true;
            audioSystem.bgMusic.volume = 0.4;
        }
        
        // Engine sound - loops and adjusts with speed
        audioSystem.engineSound = loadAudio('sounds/engine-idle.mp3', onSoundLoad);
        if (audioSystem.engineSound) {
            audioSystem.engineSound.loop = true;
            audioSystem.engineSound.volume = 0.2;
        }
        
        // Load other sound effects - initialize object with default volume
        const soundFiles = {
            collision: 'sounds/collision.mp3',
            jump: 'sounds/jump.mp3',
            land: 'sounds/land.mp3',
            dirt: 'sounds/dirt.mp3'
        };
        
        // Load each sound effect
        Object.entries(soundFiles).forEach(([name, url]) => {
            audioSystem.sounds[name] = loadAudio(url, (sound) => {
                if (sound) {
                    sound.volume = 0.3;
                }
                onSoundLoad(sound);
            });
        });
        
        // Portal sounds - reuse existing sounds
        audioSystem.sounds.portalEnter = loadAudio('sounds/jump.mp3', (sound) => {
            if (sound) {
                sound.volume = 0.3;
            }
            onSoundLoad(sound);
        });
        
        audioSystem.sounds.portalExit = loadAudio('sounds/land.mp3', (sound) => {
            if (sound) {
                sound.volume = 0.3;
            }
            onSoundLoad(sound);
        });
        
        // Create audio controls
        createAudioControls();
    } catch (e) {
        console.error('Error initializing audio system:', e);
    }
}

// Create audio controls in the UI
function createAudioControls() {
    const gameHud = document.getElementById('game-hud');
    
    const audioControlsDiv = document.createElement('div');
    audioControlsDiv.id = 'audio-controls';
    audioControlsDiv.style.position = 'absolute';
    audioControlsDiv.style.top = '80px';
    audioControlsDiv.style.left = '10px';
    audioControlsDiv.style.zIndex = '100';
    
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-audio';
    toggleButton.innerHTML = '🔊';
    toggleButton.style.background = 'rgba(0, 0, 0, 0.6)';
    toggleButton.style.color = 'white';
    toggleButton.style.border = '1px solid rgba(0, 160, 255, 0.5)';
    toggleButton.style.borderRadius = '5px';
    toggleButton.style.padding = '5px 10px';
    toggleButton.style.fontSize = '16px';
    toggleButton.style.cursor = 'pointer';
    
    toggleButton.addEventListener('click', toggleAudio);
    
    audioControlsDiv.appendChild(toggleButton);
    gameHud.appendChild(audioControlsDiv);
}

// Toggle audio mute/unmute
function toggleAudio() {
    audioSystem.isMuted = !audioSystem.isMuted;
    
    const toggleButton = document.getElementById('toggle-audio');
    if (toggleButton) {
        toggleButton.innerHTML = audioSystem.isMuted ? '🔈' : '🔊';
    }
    
    // Mute/unmute all sounds
    if (audioSystem.bgMusic) {
        audioSystem.bgMusic.muted = audioSystem.isMuted;
    }
    
    if (audioSystem.engineSound) {
        audioSystem.engineSound.muted = audioSystem.isMuted;
        
        // Stop engine sound when muted
        if (audioSystem.isMuted) {
            audioSystem.engineSound.pause();
        } else if (gameStarted) {
            try {
                audioSystem.engineSound.play().catch(e => console.warn('Error playing engine sound:', e));
            } catch (e) {
                console.warn('Error playing engine sound:', e);
            }
        }
    }
    
    // Mute/unmute sound effects
    Object.values(audioSystem.sounds).forEach(sound => {
        if (sound) {
            sound.muted = audioSystem.isMuted;
        }
    });
}

// Play a sound effect
function playSound(soundName) {
    // Exit early if audio system not ready or muted
    if (!audioSystem.sounds || !audioSystem.sounds[soundName] || audioSystem.isMuted) return;
    
    try {
        // Clone the audio to allow multiple instances to play simultaneously
        const sound = audioSystem.sounds[soundName].cloneNode();
        if (!sound) return;
        
        sound.volume = audioSystem.sounds[soundName].volume;
        
        // Add error handling for playback
        sound.onerror = function() {
            console.warn(`Error playing sound: ${soundName}`);
            sound.remove();
        };
        
        // Play the sound
        const playPromise = sound.play();
        
        // Handle play promise for modern browsers
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn(`Error starting playback of ${soundName}: ${error}`);
                sound.remove();
            });
        }
        
        // Remove the element when finished to prevent memory leaks
        sound.onended = function() {
            sound.remove();
        };
    } catch (e) {
        console.error(`Exception when playing sound ${soundName}:`, e);
    }
}

// Update engine sound based on vehicle speed
function updateEngineSound(speed) {
    if (audioSystem.isMuted || !audioSystem.engineSound) return;
    
    try {
        // Calculate playback rate based on speed (normal rate at 20 km/h)
        const baseRate = 0.8;
        const maxRate = 2.0;
        let rate = baseRate + (speed / 60) * (maxRate - baseRate);
        
        // Clamp between reasonable values
        rate = Math.max(baseRate, Math.min(rate, maxRate));
        
        // Apply the rate
        audioSystem.engineSound.playbackRate = rate;
        
        // Adjust volume slightly with speed
        audioSystem.engineSound.volume = 0.2 + (speed / 100) * 0.3;
    } catch (e) {
        console.warn('Error updating engine sound:', e);
    }
}

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
        
        // Share the player name with the window object for global access
        window.playerName = playerName;
        
        // Check if this player is the authorized editor
        isAuthorizedEditor = (playerName === 'RJ_4_America');
        window.isAuthorizedEditor = isAuthorizedEditor;
        
        console.log("Game starting with player name:", playerName);
        console.log("Editor authorization:", isAuthorizedEditor ? "GRANTED" : "DENIED");
        
        // Add a direct edit button for RJ_4_America
        if (isAuthorizedEditor) {
            const editButton = document.createElement('button');
            editButton.textContent = 'TOGGLE CHECKPOINT EDIT';
            editButton.style.position = 'absolute';
            editButton.style.top = '10px';
            editButton.style.right = '10px';
            editButton.style.padding = '10px';
            editButton.style.backgroundColor = '#e74c3c';
            editButton.style.color = 'white';
            editButton.style.border = 'none';
            editButton.style.borderRadius = '5px';
            editButton.style.fontWeight = 'bold';
            editButton.style.zIndex = '9999';
            
            editButton.addEventListener('click', function() {
                console.log("Edit button clicked");
                // Make sure controls exist first
                if (!document.getElementById('checkpoint-controls')) {
                    createCheckpointControls();
                }
                toggleEditMode();
            });
            
            document.body.appendChild(editButton);
            
            // Make the function available on window right away
            window.createCheckpointControls = createCheckpointControls;
            window.toggleEditMode = toggleEditMode;
            window.showNotification = showNotification;
        }
        
        // Add the global E key handler for checkpoint editing
        window.addEventListener('keydown', function(event) {
            if (event.key.toLowerCase() === 'e' && gameStarted) {
                console.log("E key pressed, authorized:", isAuthorizedEditor);
                if (isAuthorizedEditor) {
                    if (window.toggleEditMode) {
                        window.toggleEditMode();
                    } else {
                        console.error("toggleEditMode function not available");
                    }
                } else {
                    console.log("Edit mode denied - not RJ_4_America");
                    if (window.showNotification) {
                        window.showNotification('Only RJ_4_America can edit checkpoints', true);
                    }
                }
            }
        });
        
        // Hide the start screen
        startScreen.classList.add('hidden');
        
        // Show controls and HUD
        controlsInfo.classList.remove('hidden');
        gameHud.classList.remove('hidden');
        
        // Show checkpoint UI elements if they exist
        const checkpointElements = document.querySelectorAll('.checkpoint-ui');
        console.log("Found checkpoint UI elements:", checkpointElements.length);
        checkpointElements.forEach(el => {
            console.log("Showing checkpoint UI element:", el.id);
            el.classList.remove('hidden');
        });
        
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
        
        // Start game audio
        if (!audioSystem.isMuted) {
            // If audio is loaded, play immediately
            if (audioSystem.loaded) {
                audioSystem.bgMusic.play().catch(err => console.warn('Error playing background music:', err));
                audioSystem.engineSound.play().catch(err => console.warn('Error playing engine sound:', err));
            } else {
                // Otherwise wait for audio to load
                console.log('Waiting for audio files to load...');
                const checkAudioLoaded = setInterval(() => {
                    if (audioSystem.loaded) {
                        clearInterval(checkAudioLoaded);
                        audioSystem.bgMusic.play().catch(err => console.warn('Error playing background music:', err));
                        audioSystem.engineSound.play().catch(err => console.warn('Error playing engine sound:', err));
                        console.log('Audio playback started after loading');
                    }
                }, 500);
                
                // Add a timeout to avoid indefinite waiting
                setTimeout(() => {
                    clearInterval(checkAudioLoaded);
                    // Try to play even if loaded flag isn't set
                    try {
                        audioSystem.bgMusic.play().catch(() => {});
                        audioSystem.engineSound.play().catch(() => {});
                    } catch (e) {
                        console.warn('Gave up waiting for audio to load properly');
                    }
                }, 5000);
            }
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
    
    function handleJoystickStart(e) {
        e.preventDefault();
        isDragging = true;
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
    }
    
    function handleJoystickEnd(e) {
        if (e) e.preventDefault();
        isDragging = false;
        
        // Reset joystick thumb position
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        
        // Reset steering controls
        controls.left = false;
        controls.right = false;
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
    mobileControlsMsg.innerHTML = 'Mobile controls: Use joystick to steer and buttons to accelerate/brake.';
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

// Checkpoint system
let checkpoints = []; // Array to hold checkpoint objects
let activeCheckpoint = -1; // Index of the currently active checkpoint (-1 means none)
let checkpointPositions = null; // Will store saved positions for the current track
let isEditMode = false; // Whether checkpoints can be moved
let lastCheckpointTime = 0; // For tracking lap times
let currentLapTime = 0; // Current lap time
let bestLapTime = Infinity; // Best lap time
let trackConfigName = 'default'; // Current track configuration name
let isAuthorizedEditor = false; // Flag for authorized checkpoint editor

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
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

// Add material properties for physics
const groundMaterial = new CANNON.Material('groundMaterial');
const vehicleMaterial = new CANNON.Material('vehicleMaterial');
const assetMaterial = new CANNON.Material('assetMaterial');

// Contact materials for physics interactions
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, vehicleMaterial, {
    friction: 0.3,
    restitution: 0.3
});
const assetContactMaterial = new CANNON.ContactMaterial(vehicleMaterial, assetMaterial, {
    friction: 0.3,
    restitution: 0.4
});
world.addContactMaterial(contactMaterial);
world.addContactMaterial(assetContactMaterial);

// Lighting
const ambientLight = new THREE.AmbientLight(0xeeeeee);
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
        
        // Initialize checkpoints after track is loaded
        initCheckpoints();
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
        rampBody.addShape(rampShape);
        
        // Position with specified elevation off the ground
        const yPos = elevation + height/2;
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

    // Get velocity for HUD
    const velocity = velocityFromChassis(new THREE.Vector3());
    const velocityMagnitude = velocity.length();
    
    // Update engine sound
    updateEngineSound(velocityMagnitude * 3.6); // Convert to km/h
    
    // Handle jumps and landings for sound effects - only if chassis is ready
    if (chassisBody && atvMesh) {
        handleJumpSounds();
    }
    
    // Check for checkpoint collisions
    checkCheckpoints();
    
    // Update lap timer every frame if timing is active
    if (lastCheckpointTime > 0) {
        const currentTime = performance.now();
        currentLapTime = (currentTime - lastCheckpointTime) / 1000;
        updateCheckpointUI();
    }

    // If game has started, show checkpoint controls (only for authorized editor)
    if (gameStarted && document.getElementById('checkpoint-controls') && isAuthorizedEditor) {
        document.getElementById('checkpoint-controls').style.display = 'block';
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

// Add portal visited flags to track when to play sounds
let startPortalVisited = false;
let exitPortalVisited = false;

// Add portal sound effects to the vibeVerse function
function vibeVerse() {
    // console.log("vibeVerse function called");
    if (new URLSearchParams(window.location.search).get('portal')) {
        // <check if player has entered start portal>
        if (atvMesh && startPortalBox) {
            const playerBox = new THREE.Box3().setFromObject(atvMesh);
            const portalDistance = playerBox.getCenter(new THREE.Vector3()).distanceTo(startPortalBox.getCenter(new THREE.Vector3()));
            
            // If player is within range of the portal
            if (portalDistance < 15) {
                // Play portal sound when first getting close
                if (portalDistance < 10 && !startPortalVisited) {
                    playSound('portalEnter');
                    startPortalVisited = true;
                }
            }
            
            // Reset visited flag when far from portal
            if (portalDistance > 30) {
                startPortalVisited = false;
            }
            
            if (playerBox.intersectsBox(startPortalBox)) {
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
        // </check if player has entered start portal>
    }

    // <check if player has entered exit portal>
    if (atvMesh && exitPortalBox) {
        const playerBox = new THREE.Box3().setFromObject(atvMesh);
        // Check if player is within 50 units of the portal
        const portalCenter = exitPortalBox.getCenter(new THREE.Vector3());
        
        const playerCenter = playerBox.getCenter(new THREE.Vector3());
        // console.log("Player position:", playerCenter);
        
        const portalDistance = playerCenter.distanceTo(portalCenter);
        
        // If player is within range of the portal
        if (portalDistance < 15) {
            // Play portal sound when first getting close
            if (portalDistance < 10 && !exitPortalVisited) {
                playSound('portalExit');
                exitPortalVisited = true;
            }
            
            // Start loading the next page in the background
            const currentParams = new URLSearchParams(window.location.search);
            const newParams = new URLSearchParams();
            newParams.append('portal',true);
            newParams.append('username', playerName);
            newParams.append('color','white');
            
            // Calculate current speed from vehicle velocity
            if (chassisBody) {
                const currentSpeed = Math.round(chassisBody.velocity.length());
                newParams.append('speed', currentSpeed);
            }

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
        }
        
        // Reset visited flag when far from portal
        if (portalDistance > 30) {
            exitPortalVisited = false;
        }
        
        // Only redirect once actually in the portal
        if (portalDistance < 3 || playerBox.intersectsBox(exitPortalBox)) {
            const currentParams = new URLSearchParams(window.location.search);
            const newParams = new URLSearchParams();
            newParams.append('portal',true);
            newParams.append('username', playerName);
            newParams.append('color','white');
            
            // Calculate current speed from vehicle velocity
            if (chassisBody) {
                const currentSpeed = Math.round(chassisBody.velocity.length());
                newParams.append('speed', currentSpeed);
            }
            
            for (const [key, value] of currentParams) {
                newParams.append(key, value);
            }
            const paramString = newParams.toString();
            const nextPage = 'https://portal.pieter.com' + (paramString ? '?' + paramString : '');
            
            // console.log("Portal intersection detected! Redirecting to:", nextPage);
            window.location.href = nextPage;
        }
    }
    // </check if player has entered exit portal>
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

// Check if vehicle is jumping or landing for sound effects
let isInAir = false;
let lastY = 0; // This should be initialized with the initial chassis position
let jumpThreshold = 0.1;
let landingThreshold = 0.05;

// Set initial lastY value when chassis is ready
if (chassisBody) {
    lastY = chassisBody.position.y;
}

function handleJumpSounds() {
    if (!chassisBody) return;
    
    // Initialize lastY if it's the first time running the function
    if (lastY === 0 && chassisBody.position.y !== 0) {
        lastY = chassisBody.position.y;
        return; // Skip the first frame to get a proper diff next time
    }
    
    const currentY = chassisBody.position.y;
    const yDiff = currentY - lastY;
    
    // Detect takeoff
    if (!isInAir && yDiff > jumpThreshold) {
        isInAir = true;
        playSound('jump');
    }
    
    // Detect landing
    if (isInAir && yDiff < -landingThreshold && chassisBody.velocity.y < -1) {
        isInAir = false;
        playSound('land');
        
        // Play dirt sound on hard landings
        if (chassisBody.velocity.y < -5) {
            playSound('dirt');
        }
    }
    
    lastY = currentY;
}

// Add collision detection for sound effects
let lastCollisionTime = 0;
world.addEventListener('beginContact', function(event) {
    if (!chassisBody) return;
    
    // Check if one of the bodies is the vehicle chassis
    let isVehicleCollision = false;
    let impactVelocity = 0;
    
    if (event.bodyA === chassisBody || event.bodyB === chassisBody) {
        isVehicleCollision = true;
        
        // Calculate relative velocity between the bodies
        const relativeVelocity = new CANNON.Vec3();
        event.bodyB.velocity.vsub(event.bodyA.velocity, relativeVelocity);
        impactVelocity = relativeVelocity.length();
        
        // Play collision sound for significant impacts with rate limiting
        const now = performance.now();
        if (impactVelocity > 4 && now - lastCollisionTime > 300) {
            playSound('collision');
            lastCollisionTime = now;
        }
    }
});

// After track loading, initialize checkpoints
function initCheckpoints() {
    console.log("=========== CHECKPOINT INIT STARTED ===========");
    console.log("Initializing checkpoints, player name:", playerName);
    console.log("Current window.playerName:", window.playerName);
    
    // Test manual setting for debugging
    window.playerName = playerName;
    
    // Check if current player is authorized to edit checkpoints
    isAuthorizedEditor = (playerName === 'RJ_4_America');
    console.log("isAuthorizedEditor:", isAuthorizedEditor);
    
    // Try to load saved checkpoint positions for this track
    const trackId = 'drift_race_track'; // Unique ID for the current track
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const configParam = urlParams.get('trackConfig');
    console.log("URL track config parameter:", configParam);
    
    if (isAuthorizedEditor) {
        // Authorized editor can specify which config to load via URL
        if (configParam) {
            trackConfigName = configParam;
            console.log("Authorized editor loading specified config:", trackConfigName);
            loadTrackConfig(trackConfigName);
        } else {
            // Default to 'default' if no specific config is requested
            console.log("Authorized editor loading default config");
            loadTrackConfig('default');
        }
    } else {
        // Regular players always load default.json
        console.log("Regular player loading default config");
        loadTrackConfig('default');
    }
    
    // Create checkpoints - either at saved positions or defaults
    createCheckpoints();
    
    // Add keyboard listener for checkpoint editing (for all players, we'll check auth inside)
    window.addEventListener('keydown', (event) => {
        console.log("Key pressed:", event.key, "isAuthorizedEditor:", isAuthorizedEditor, "gameStarted:", gameStarted);
        if (event.key.toLowerCase() === 'e' && gameStarted) {
            console.log("E key pressed, isAuthorizedEditor:", isAuthorizedEditor);
            // Check if player is authorized to edit
            if (isAuthorizedEditor) {
                toggleEditMode();
                console.log("Toggle edit mode activated");
            } else {
                showNotification('Only big balls can edit checkpoints', true);
            }
        }
    });
    
    // Add checkpoint editor controls (only for authorized editor)
    if (isAuthorizedEditor) {
        console.log("Creating editor controls for authorized user");
        createCheckpointControls();
        
        // Welcome message for the editor
        showNotification('Welcome RJ_4_America - Track Editor Mode Available (Press E)');
    }
    
    // Expose key variables and functions to the window object for access from multiplayer.js
    window.playerName = playerName;
    window.isAuthorizedEditor = isAuthorizedEditor;
    window.isEditMode = isEditMode;
    window.createCheckpointControls = createCheckpointControls;
    window.showNotification = showNotification;
    window.toggleEditMode = toggleEditMode;
    
    console.log("=========== CHECKPOINT INIT COMPLETED ===========");
}

// Create the checkpoint editor UI
function createCheckpointControls() {
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
    configNameInput.value = trackConfigName;
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
    editButton.addEventListener('click', toggleEditMode);
    saveButton.addEventListener('click', saveCheckpointPositions);
    exportButton.addEventListener('click', exportCheckpointPositions);
    resetButton.addEventListener('click', resetCheckpointPositions);
    
    // Update config name when changed
    configNameInput.addEventListener('change', () => {
        trackConfigName = configNameInput.value || 'default';
    });
    
    // Keyboard shortcut for edit mode
    document.addEventListener('keydown', (event) => {
        if (event.key === 'e' && gameStarted) {
            // Check if player is authorized to edit
            if (isAuthorizedEditor) {
                toggleEditMode();
            } else {
                showNotification('Only RJ_4_America can edit checkpoints', true);
            }
        }
    });
    
    console.log("Checkpoint editor controls created and added to the DOM");
}

// Export checkpoint positions to a JSON file
function exportCheckpointPositions() {
    // Get the configuration name
    const configNameInput = document.getElementById('config-name-input');
    const configName = (configNameInput ? configNameInput.value : trackConfigName) || 'default';
    
    // Create the export data
    const positions = checkpoints.map(cp => ({
        x: cp.mesh.position.x,
        y: cp.mesh.position.y,
        z: cp.mesh.position.z
    }));
    
    const exportData = {
        trackId: 'drift_race_track',
        configName: configName,
        date: new Date().toISOString(),
        positions: positions
    };
    
    // Convert to JSON and create a download link
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create and trigger download link for the user to save locally
    const a = document.createElement('a');
    a.href = url;
    a.download = `track_config_${configName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Also save this configuration as "default.json" for all other players
    // Note: In a real application, this would be done server-side
    // This is a client-side simulation of updating the default.json file
    fetch('/save-default-track', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: jsonData
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        }
        throw new Error('Failed to save default track configuration');
    })
    .then(data => {
        console.log('Default track saved successfully:', data);
        showNotification('Track configuration saved as default for all players');
    })
    .catch(error => {
        console.error('Error saving default track:', error);
        showNotification('Note: Default track could not be saved automatically. Please ask RJ to upload the file.', true);
    });
    
    // Show confirmation message
    const infoText = document.getElementById('checkpoint-info');
    if (infoText) {
        infoText.style.backgroundColor = 'rgba(46, 204, 113, 0.3)'; // Green bg
        infoText.textContent = `Exported "${configName}" configuration!`;
        setTimeout(() => {
            infoText.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            infoText.textContent = isEditMode 
                ? 'EDIT MODE: Drive near checkpoints to move them'
                : 'Press E to toggle editor';
        }, 3000);
    }
    
    console.log(`Exported checkpoint configuration "${configName}":`, positions);
}

// Function to load a track configuration from a JSON file
async function loadTrackConfig(configName) {
    console.log(`Attempting to load track config: ${configName}`);
    try {
        // Add a random cache-busting parameter to avoid browser caching
        const cacheParam = `?t=${Date.now()}`;
        const response = await fetch(`checkpoints/${configName}.json${cacheParam}`);
        
        if (!response.ok) {
            console.warn(`Failed to load configuration: ${response.statusText}`);
            
            // If the requested config isn't 'default' and it failed, try loading default as a fallback
            if (configName !== 'default') {
                console.log(`Falling back to default configuration`);
                return loadTrackConfig('default');
            }
            
            // If we're already trying to load default and it failed, use hardcoded defaults
            throw new Error(`Failed to load default configuration: ${response.statusText}`);
        }
        
        const config = await response.json();
        if (config.positions && Array.isArray(config.positions)) {
            // Clear any existing checkpoint positions
            checkpointPositions = config.positions;
            trackConfigName = config.configName || configName;
            
            // Update input field if it exists
            const configNameInput = document.getElementById('config-name-input');
            if (configNameInput) {
                configNameInput.value = trackConfigName;
            }
            
            console.log(`Loaded checkpoint configuration "${trackConfigName}":`, checkpointPositions);
            
            // Proper cleanup and removal of existing checkpoints
            cleanupCheckpoints();
            
            // Re-create checkpoints with the loaded positions
            createCheckpoints();
            
            // Show confirmation message
            showNotification(`Loaded track config: ${trackConfigName}`);
            return true;
        } else {
            throw new Error('Invalid configuration format');
        }
    } catch (error) {
        console.error(`Error loading track configuration "${configName}":`, error);
        
        // Set to default hardcoded positions if loading fails
        checkpointPositions = [
            { x: 50, y: 3, z: 50 },
            { x: -50, y: 3, z: 50 },
            { x: -50, y: 3, z: -50 },
            { x: 50, y: 3, z: -50 }
        ];
        
        // Proper cleanup of existing checkpoints
        cleanupCheckpoints();
        
        // If we're not using hardcoded defaults, show an error
        if (configName !== 'default') {
            showNotification(`Failed to load track config: ${configName}`, true);
        }
        
        // Re-create checkpoints with the default positions
        createCheckpoints();
        
        return false;
    }
}

// Helper function to properly cleanup checkpoints
function cleanupCheckpoints() {
    if (!checkpoints || !Array.isArray(checkpoints)) return;
    
    console.log("Cleaning up checkpoints:", checkpoints.length);
    
    checkpoints.forEach(cp => {
        if (cp.mesh) {
            scene.remove(cp.mesh);
            if (cp.mesh.material) {
                cp.mesh.material.dispose();
            }
            if (cp.mesh.geometry) {
                cp.mesh.geometry.dispose();
            }
        }
        
        if (cp.moveHelper) {
            scene.remove(cp.moveHelper);
        }
        
        if (cp.numberLabel) {
            // Call dispose method to properly clean up animation
            if (typeof cp.numberLabel.dispose === 'function') {
                cp.numberLabel.dispose();
            }
            scene.remove(cp.numberLabel);
        }
    });
    
    // Reset the array
    checkpoints = [];
}

// Show a notification message
function showNotification(message, isError = false) {
    // Skip notifications on mobile devices to keep the UI clean
    if (window.isMobileDevice) {
        // Just log the notification message instead
        console.log(`Mobile notification (${isError ? 'error' : 'info'}):`, message);
        return;
    }
    
    const notification = document.createElement('div');
    notification.style.position = 'absolute';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '10px 20px';
    notification.style.backgroundColor = isError ? 'rgba(231, 76, 60, 0.9)' : 'rgba(46, 204, 113, 0.9)';
    notification.style.color = 'white';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '2000';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.fontSize = '16px';
    notification.style.fontWeight = 'bold';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds with fade effect
    setTimeout(() => {
        notification.style.transition = 'opacity 0.5s ease-out';
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

// Toggle checkpoint edit mode
function toggleEditMode() {
    console.log("========= TOGGLE EDIT MODE =========");
    console.log("Authorization check, isAuthorizedEditor:", isAuthorizedEditor);
    console.log("Current playerName:", playerName);
    console.log("Current window.playerName:", window.playerName);
    
    // Force check authorization from window to fix potential timing issues
    isAuthorizedEditor = (window.playerName === 'RJ_4_America');
    
    // Make sure only authorized editors can toggle edit mode
    if (!isAuthorizedEditor) {
        console.log("Toggle edit mode failed - not authorized");
        showNotification('Only RJ_4_America can edit checkpoints', true);
        return;
    }
    
    console.log("Toggle edit mode authorized, current mode:", isEditMode);
    isEditMode = !isEditMode;
    window.isEditMode = isEditMode; // Make sure window object is updated too
    console.log("New edit mode:", isEditMode);
    
    // Update UI
    const controlsDiv = document.getElementById('checkpoint-controls');
    const infoText = document.getElementById('checkpoint-info');
    
    if (controlsDiv) {
        console.log("Controls div exists");
    } else {
        console.log("Controls div does not exist");
    }
    
    if (infoText) {
        infoText.textContent = isEditMode 
            ? 'EDIT MODE: Drive near checkpoints to move them'
            : 'Press E to toggle editor';
        infoText.style.backgroundColor = isEditMode ? 'rgba(231, 76, 60, 0.3)' : 'rgba(0, 0, 0, 0.3)';
    }
    
    // Update checkpoint visuals
    checkpoints.forEach(checkpoint => {
        // Make checkpoints more visible in edit mode
        checkpoint.mesh.material.opacity = isEditMode ? 0.8 : 0.4;
        // Show the helper arrows only in edit mode
        if (checkpoint.moveHelper) {
            checkpoint.moveHelper.visible = isEditMode;
        }
    });
    
    console.log(`Checkpoint edit mode: ${isEditMode ? 'ENABLED' : 'DISABLED'}`);
    
    // Show notification
    showNotification(isEditMode ? 'Checkpoint Edit Mode: ON' : 'Checkpoint Edit Mode: OFF');
    console.log("========= TOGGLE EDIT MODE COMPLETE =========");
}

// Save checkpoint positions to localStorage
function saveCheckpointPositions() {
    const trackId = 'drift_race_track'; // Unique ID for the current track
    const positions = checkpoints.map(cp => ({
        x: cp.mesh.position.x,
        y: cp.mesh.position.y,
        z: cp.mesh.position.z
    }));
    
    localStorage.setItem(`checkpoints_${trackId}`, JSON.stringify(positions));
    checkpointPositions = positions;
    
    // Update UI
    const infoText = document.getElementById('checkpoint-info');
    if (infoText) {
        infoText.textContent = 'Checkpoint positions saved!';
        setTimeout(() => {
            infoText.textContent = isEditMode 
                ? 'EDIT MODE: Click and drag checkpoints. Press E to exit.'
                : 'Press E to toggle checkpoint editor';
        }, 2000);
    }
    
    console.log('Saved checkpoint positions:', positions);
}

// Reset checkpoint positions to defaults
function resetCheckpointPositions() {
    // Default positions spread around the track
    const defaultPositions = [
        { x: 50, y: 3, z: 50 },
        { x: -50, y: 3, z: 50 },
        { x: -50, y: 3, z: -50 },
        { x: 50, y: 3, z: -50 }
    ];
    
    // Update checkpoint positions
    checkpoints.forEach((checkpoint, index) => {
        const pos = defaultPositions[index];
        checkpoint.mesh.position.set(pos.x, pos.y, pos.z);
        updateCheckpointCollider(checkpoint);
    });
    
    // Update UI
    const infoText = document.getElementById('checkpoint-info');
    if (infoText) {
        infoText.textContent = 'Checkpoint positions reset!';
        setTimeout(() => {
            infoText.textContent = isEditMode 
                ? 'EDIT MODE: Click and drag checkpoints. Press E to exit.'
                : 'Press E to toggle checkpoint editor';
        }, 2000);
    }
    
    console.log('Reset checkpoint positions to defaults');
}

// Create checkpoints
function createCheckpoints() {
    // Clean up any existing checkpoints
    cleanupCheckpoints();
    
    // Reset checkpoint tracker
    activeCheckpoint = 0;
    
    // Default positions or loaded positions
    const positions = checkpointPositions || [
        { x: 50, y: 3, z: 50 },
        { x: -50, y: 3, z: 50 },
        { x: -50, y: 3, z: -50 },
        { x: 50, y: 3, z: -50 }
    ];
    
    // Create 4 checkpoints
    for (let i = 0; i < 4; i++) {
        const checkpoint = createCheckpoint(
            positions[i].x, 
            positions[i].y, 
            positions[i].z, 
            i
        );
        checkpoints.push(checkpoint);
    }
    
    console.log('Created', checkpoints.length, 'checkpoints');
    
    // Update checkpoint UI
    updateCheckpointUI();
}

// Create a single checkpoint
function createCheckpoint(x, y, z, index) {
    // Create the visual representation - a translucent ring
    const ringGeometry = new THREE.TorusGeometry(10, 1, 16, 32);
    
    // Use different colors for each checkpoint, last one is special
    let color;
    if (index === 0) color = 0x4CAF50; // Green for start/finish
    else if (index === 1) color = 0x2196F3; // Blue
    else if (index === 2) color = 0xFF9800; // Orange
    else color = 0x9C27B0; // Purple
    
    const ringMaterial = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(x, y, z);
    ring.rotation.x = Math.PI / 2; // Make the ring vertical (perpendicular to ground)
    ring.castShadow = false;
    ring.receiveShadow = false;
    ring.userData.isCheckpoint = true;
    ring.userData.checkpointIndex = index;
    scene.add(ring);
    
    // Add a directional arrow to help with movement in edit mode
    const arrowHelper = createArrowHelper(x, y, z, color);
    arrowHelper.visible = false; // Hidden by default, shown in edit mode
    scene.add(arrowHelper);
    
    // Add visible checkpoint number
    const checkpointNumber = createCheckpointNumber(x, y, z, index);
    scene.add(checkpointNumber);
    
    // Create bounding box for collision detection
    const checkpointBox = new THREE.Box3().setFromObject(ring);
    
    // Return the complete checkpoint object
    return {
        mesh: ring,
        collider: checkpointBox,
        moveHelper: arrowHelper,
        numberLabel: checkpointNumber,
        index: index,
        passed: false
    };
}

// Create a number label for the checkpoint
function createCheckpointNumber(x, y, z, index) {
    // Create a floating number above the checkpoint
    const group = new THREE.Group();
    group.position.set(x, y + 15, z);
    
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
    
    // Add animation effect to make the number float up and down
    const animate = function() {
        // Small float up and down motion
        group.position.y = y + 15 + Math.sin(Date.now() * 0.001) * 2;
        
        // Rotate to face the camera
        if (camera) {
            const lookAtVector = new THREE.Vector3(0, 0, -1);
            lookAtVector.applyQuaternion(camera.quaternion);
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            sprite.rotation.z = Math.atan2(cameraDirection.x, cameraDirection.z);
        }
        
        // Store animation ID for potential cancellation
        animationId = requestAnimationFrame(animate);
    };
    
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

// Create an arrow helper for moving checkpoints
function createArrowHelper(x, y, z, color) {
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
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('#', 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: texture });
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(5, 5, 1);
    label.position.set(0, 2, 0);
    arrowGroup.add(label);
    
    return arrowGroup;
}

// Update checkpoint bounding box after movement
function updateCheckpointCollider(checkpoint) {
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

// Handle checkpoint collision detection
function checkCheckpoints() {
    if (!atvMesh || checkpoints.length === 0) return;
    
    // Create a bounding box for the ATV
    const atvBox = new THREE.Box3().setFromObject(atvMesh);
    
    // Check if the ATV is inside the active checkpoint
    const activeCP = checkpoints[activeCheckpoint];
    if (activeCP && atvBox.intersectsBox(activeCP.collider)) {
        // Player passed through the current checkpoint
        if (!activeCP.passed) {
            activeCP.passed = true;
            
            // Play sound for checkpoint
            playSound(activeCP.index === 0 ? 'portalEnter' : 'portalExit');
            
            // Show success message
            showCheckpointMessage(activeCP.index);
            
            // Calculate lap time if this is the start/finish checkpoint
            if (activeCP.index === 0 && lastCheckpointTime > 0) {
                const currentTime = performance.now();
                currentLapTime = (currentTime - lastCheckpointTime) / 1000; // Convert to seconds
                
                // Update best lap time
                if (currentLapTime < bestLapTime) {
                    bestLapTime = currentLapTime;
                    showLapTimeMessage(currentLapTime, true);
                } else {
                    showLapTimeMessage(currentLapTime, false);
                }
            }
            
            // Record the time for lap timing
            if (activeCP.index === 0) {
                lastCheckpointTime = performance.now();
            }
            
            // Move to the next checkpoint
            activeCheckpoint = (activeCheckpoint + 1) % checkpoints.length;
            
            // Update the UI
            updateCheckpointUI();
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
    if (isEditMode && isAuthorizedEditor && chassisBody) {
        console.log("In edit mode, moving checkpoints enabled");
        // Check if a checkpoint is close enough to move
        for (let i = 0; i < checkpoints.length; i++) {
            const cp = checkpoints[i];
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
                    updateCheckpointCollider(cp);
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
function showCheckpointMessage(checkpointIndex) {
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
function showLapTimeMessage(lapTime, isBest) {
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
function updateCheckpointUI() {
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
        if (gameStarted) {
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
        if (gameStarted) {
            lapTimeDisplay.classList.remove('hidden');
        }
        
        document.body.appendChild(lapTimeDisplay);
        
        // Show checkpoint controls when game has started
        const checkpointControls = document.getElementById('checkpoint-controls');
        if (checkpointControls && gameStarted) {
            checkpointControls.style.display = 'block';
        }
    } else if (gameStarted) {
        // If game has started, ensure all checkpoint UI elements are visible
        document.querySelectorAll('.checkpoint-ui').forEach(el => {
            el.classList.remove('hidden');
        });
    }
    
    // Update checkpoint status
    const checkpointStatus = document.getElementById('checkpoint-status');
    if (checkpointStatus && checkpoints.length > 0) {
        checkpointStatus.innerHTML = `
            <div class="checkpoint-label">CHECKPOINTS</div>
            <div>Next: ${activeCheckpoint + 1} of ${checkpoints.length}</div>
        `;
    }
    
    // Update lap times
    const lapTimeDisplay = document.getElementById('lap-time');
    if (lapTimeDisplay) {
        lapTimeDisplay.innerHTML = `
            <div class="checkpoint-label">LAP TIMES</div>
            <div>Current: ${currentLapTime.toFixed(2)}s</div>
            <div>Best: ${bestLapTime === Infinity ? '--' : bestLapTime.toFixed(2) + 's'}</div>
        `;
    }
    
    // Update the checkpoint visuals
    checkpoints.forEach((checkpoint, index) => {
        // Special color for active checkpoint
        if (index === activeCheckpoint) {
            checkpoint.mesh.material.emissiveIntensity = 0.8;
            checkpoint.mesh.material.opacity = 0.7;
        } else {
            checkpoint.mesh.material.emissiveIntensity = 0.3;
            checkpoint.mesh.material.opacity = 0.4;
        }
    });
}