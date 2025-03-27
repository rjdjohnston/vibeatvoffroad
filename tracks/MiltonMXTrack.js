/**
 * MiltonMXTrack.js - Implementation of the Milton MX track
 * Extends the BaseTrack class to provide a motocross track experience
 */

import BaseTrack from './BaseTrack.js';
import HeightMapGenerator from '../utils/HeightMapGenerator.js';

/**
 * Milton MX Track - implements a motocross track with terrain features
 */
class MiltonMXTrack extends BaseTrack {
    constructor(options) {
        super(options);
        this.name = 'Milton MX Track';
        this.modelPath = 'models/tracks/milton_mx_4k.glb';
        this.debugEnabled = false; // Keep debug visualization disabled per user preference
        this.showHeightMapOverlay = true; // Show just the height map overlay without other debug elements
        
        // Scale factor for the track model
        this.modelScale = 1.0; // Match the multiplier used for physics dimensions
        
        // User preferences for which ramps to show
        this.rampVisibility = {
            north: true,  // red ramp
            east: true,   // green ramp
            south: true,   // blue ramp
            west: true    // yellow ramp
        };
        
        // Track dimensions - default values
        this.trackDimensions = {
            width: 600, // Default width before model is loaded
            length: 600, // Default length before model is loaded
            height: 200  // Default height before model is loaded
        };
        
        // Height map settings
        this.useHeightMap = true;
        this.heightMapResolution = 256; // Increased resolution for better detail
        this.heightMapMesh = null;
        this.heightfieldBody = null;
        
        // Track level settings - important for alignment
        this.groundLevel = -20; // Set to match where the ATV actually is
        this.actualGroundLevel = -20; // Will be updated based on vehicle position
        
        // Flag to track if height map position has been updated
        this.heightMapPositionUpdated = false;
        
        // Track-specific physics properties
        this.trackFriction = 0.1;  // Lower friction for faster movement
        this.trackRestitution = 0.1; // Lower restitution for less bouncing
        
        // Initialize arrays for game objects
        this.ramps = [];
        this.rampMeshes = [];
        this.checkpoints = [];
        this.lights = [];
        this.walls = [];
        this.debugMeshes = [];
    }
    
    /**
     * Get track-specific vehicle settings
     * This is called by the main script to adjust vehicle physics for this track
     * @returns {Object} Vehicle settings for this track
     */
    getVehicleSettings() {
        return this.vehicleSettings;
    }
    
    /**
     * Load the track
     * @returns {Promise} - A promise that resolves when the track is loaded
     */
    async load() {
        console.log(`Loading Milton MX track model: ${this.modelPath}`);
        
        // Create a promise to handle the asynchronous loading
        return new Promise((resolve, reject) => {
            // Load the model using THREE.GLTFLoader
            const loader = new THREE.GLTFLoader();
            loader.load(
                this.modelPath,
                (gltf) => {
                    this.trackMesh = gltf.scene;
                    
                    // Scale and position the track
                    this.trackMesh.scale.set(this.modelScale, this.modelScale, this.modelScale);
                    this.trackMesh.position.set(0, this.groundLevel, 0); // Position at the same ground level (-20) as the height map and ATV
                    
                    // Extract dimensions from model for reference
                    console.log(`Scaling track model by factor: ${this.modelScale}`);
                    
                    // Log model structure for debugging
                    this.logModelStructure(this.trackMesh);
                    
                    // Add the track to the scene
                    this.scene.add(this.trackMesh);
                    
                    // Create physics for the track using main physics method
                    this.createPhysics();
                    
                    // Create checkpoints and ramps
                    this.createCheckpoints();
                    this.createRamps();
                    
                    console.log('Milton MX track loaded successfully');
                    resolve(this);
                },
                (xhr) => {
                    // Progress callback
                    console.log(`${(xhr.loaded / xhr.total * 100).toFixed(0)}% loaded`);
                },
                (xhr) => {
                    // Error callback
                    console.error('Error loading Milton MX track:', xhr);
                    reject(xhr);
                }
            );
        });
    }
    
    /**
     * Log the structure of the loaded model for debugging
     * @param {THREE.Object3D} object - The object to log
     * @param {string} indent - Indentation for nested objects
     */
    logModelStructure(object, indent = '') {
        console.log(`${indent}${object.name || 'unnamed'} [${object.type}]`);
        if (object.isMesh) {
            console.log(`${indent}  - geometry: ${object.geometry.type}, vertices: ${object.geometry.attributes.position.count}`);
            console.log(`${indent}  - material: ${object.material.type}`);
        }
        if (object.children && object.children.length > 0) {
            object.children.forEach(child => {
                this.logModelStructure(child, indent + '  ');
            });
        }
    }
    
    /**
     * Adjust vehicle physics specifically for this track
     * This will be called when the track is loaded
     */
    adjustVehiclePhysics() {
        // Find the vehicle in the world
        this.world.bodies.forEach(body => {
            // Check if this is the vehicle chassis
            if (body.mass > 0 && body.shapes.length > 0) {
                // This is likely the vehicle chassis
                console.log('Adjusting vehicle physics for Milton MX track');
                
                // Increase the maximum force for faster acceleration
                if (body.vehicle && body.vehicle.wheelInfos) {
                    body.vehicle.wheelInfos.forEach(wheel => {
                        // Increase engine force for faster acceleration
                        wheel.engineForce = 0;
                        wheel.maxEngineForce = this.vehicleSettings.maxEngineForce; // Higher value for more speed
                        
                        // Reduce rolling friction for faster movement
                        wheel.rollInfluence = this.vehicleSettings.rollInfluence; // Lower value for less rolling resistance
                        
                        // Adjust suspension for better handling
                        wheel.suspensionStiffness = this.vehicleSettings.suspensionStiffness;
                        wheel.dampingRelaxation = this.vehicleSettings.dampingRelaxation;
                        wheel.dampingCompression = this.vehicleSettings.dampingCompression;
                        
                        console.log(`Adjusted wheel physics: maxEngineForce=${wheel.maxEngineForce}, rollInfluence=${wheel.rollInfluence}`);
                    });
                }
                
                // Reduce angular damping for more responsive turning
                body.angularDamping = this.vehicleSettings.angularDamping;
                
                // Reduce linear damping for less resistance to forward movement
                body.linearDamping = this.vehicleSettings.linearDamping;
                
                // Apply a small constant torque to counteract the left turning bias
                if (this.vehicleSettings.rightBias) {
                    // Apply a very small rightward correction
                    body.torque.y = -this.vehicleSettings.rightBias * 100;
                    console.log(`Applied right bias correction: ${this.vehicleSettings.rightBias}`);
                }
                
                console.log('Vehicle physics adjusted for Milton MX track');
            }
        });
        
        // Create a custom contact material for this track
        this.createCustomContactMaterial();
    }
    
    /**
     * Create a custom contact material for this track
     * This will modify how the vehicle interacts with the track surface
     */
    createCustomContactMaterial() {
        // Create a custom material for the track
        const trackMaterial = new CANNON.Material('miltonTrackMaterial');
        
        // Find the vehicle material
        let vehicleMaterial = null;
        
        // Look for existing materials in the world
        this.world.materials.forEach(material => {
            if (material.name === 'vehicleMaterial' || material.name === 'wheelMaterial') {
                vehicleMaterial = material;
            }
        });
        
        // If we found a vehicle material, create a contact material
        if (vehicleMaterial) {
            const contactMaterial = new CANNON.ContactMaterial(
                trackMaterial,
                vehicleMaterial,
                {
                    friction: this.trackFriction,
                    restitution: this.trackRestitution,
                    contactEquationStiffness: 1e8,
                    contactEquationRelaxation: 3
                }
            );
            
            this.world.addContactMaterial(contactMaterial);
            console.log(`Created custom contact material: friction=${this.trackFriction}, restitution=${this.trackRestitution}`);
        }
        
        // Store the track material for use in physics bodies
        this.trackMaterial = trackMaterial;
        
        // Apply the material to existing physics bodies
        if (this.heightfieldBody) {
            this.heightfieldBody.material = trackMaterial;
        }
    }
    
    /**
     * Calculate the bounding box of the track model to determine its dimensions
     * @param {THREE.Object3D} trackMesh - The track mesh to compute the bounding box for
     * @returns {Object} - The bounding box dimensions
     */
    computeBoundingBox(trackMesh) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        // Traverse the track mesh to find its dimensions
        trackMesh.traverse((child) => {
            if (child.isMesh) {
                // Compute bounding box for this mesh
                if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                }
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
        
        console.log(`Raw track bounds: X(${minX} to ${maxX}), Y(${minY} to ${maxY}), Z(${minZ} to ${maxZ})`);
        
        // Return the bounding box dimensions
        return {
            width: Math.max(Math.abs(minX), Math.abs(maxX)) * 2, // Use 2 here since model is already scaled
            length: Math.max(Math.abs(minZ), Math.abs(maxZ)) * 2, // Use 2 here since model is already scaled
            height: maxY - minY,
            centerX: 0,
            centerY: 0,
            centerZ: 0,
            minY: minY,
            maxY: maxY
        };
    }
    
    /**
     * Create physics bodies for the track
     * This is the main entry point for physics creation
     */
    createPhysics() {
        console.log('Creating physics for Milton MX track');
        
        if (this.useHeightMap) {
            console.log('Using height map for physics');
            this.createHeightMapPhysics(this.trackMesh);
        } else {
            console.log('Using flat physics');
            this.createFlatPhysics();
        }
    }

    /**
     * Create flat physics for the track
     * This is used as a fallback if height map creation fails
     */
    createFlatPhysics() {
        console.log('Creating flat physics for Milton MX track');
        
        // Create a flat ground plane
        const groundBody = new CANNON.Body({
            mass: 0,
            material: this.materials.ground
        });
        
        // Use a large plane to ensure the vehicle can't fall off
        const groundShape = new CANNON.Plane();
        groundBody.addShape(groundShape);
        
        // Rotate to be horizontal and position at ground level
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        groundBody.position.set(0, this.groundLevel, 0);
        
        this.world.addBody(groundBody);
        this.trackCollider = groundBody;
        
        // Create our hot pink floor visualization even with flat physics
        this.createHotPinkFloor();
        
        console.log('Flat physics created successfully');
    }
    
    /**
     * Create physics using a height map generated from the terrain mesh
     * @param {THREE.Object3D} terrainMesh - The mesh to use for height map generation
     */
    createHeightMapPhysics(terrainMesh) {
        console.log('Creating artificial hot pink terrain for visual debugging');
        
        // Use defined track dimensions to create our hot pink height map
        console.log(`Using track dimensions: ${this.trackDimensions.width}x${this.trackDimensions.length}`);
        
        // Generate artificial terrain for visualization
        const heightMap = HeightMapGenerator.generateArtificialTerrain({
            resolution: this.heightMapResolution,
            width: this.trackDimensions.width,
            length: this.trackDimensions.length
        });
        
        if (!heightMap) {
            console.error('Failed to generate height map, falling back to flat physics');
            this.createFlatPhysics();
            return;
        }
        
        console.log(`Hot pink terrain generated with height range: ${heightMap.minHeight} to ${heightMap.maxHeight}`);
        
        // Create the heightfield body
        this.heightfieldBody = HeightMapGenerator.createHeightfieldBody(heightMap, this.world);
        
        // Adjust the heightfield position to ensure it aligns with the visual mesh
        if (this.heightfieldBody) {
            // Adjust the Y position to ensure the terrain is at ground level
            this.heightfieldBody.position.y = this.groundLevel; // Use consistent ground level
            console.log(`Adjusted heightfield position to y=${this.heightfieldBody.position.y}`);
        }
        
        this.trackCollider = this.heightfieldBody;
        
        // Create a hot pink visualization of the height map for debugging
        this.heightMapMesh = HeightMapGenerator.createHeightMapVisualization(heightMap, this.scene);
        
        // Position the visualization mesh to match the physics body
        if (this.heightMapMesh) {
            // Position exactly at the same coordinates as the physics body but at the ground level
            this.heightMapMesh.position.set(
                this.heightfieldBody.position.x, 
                this.groundLevel, // Exactly at ground level
                this.heightfieldBody.position.z
            );
            
            // Make sure it's visible
            this.heightMapMesh.visible = true;
            
            // Create a clearly visible hot pink floor
            this.createHotPinkFloor();
            
            console.log('Added HOT PINK terrain visualization for debugging at ground level: ' + this.groundLevel);
        }
        
        console.log('Hot pink terrain visualized successfully');
    }
    
    /**
     * Create a clearly visible hot pink floor for debugging
     */
    createHotPinkFloor() {
        // Create a wireframe floor plane to ensure visibility of ground level
        const floorGeometry = new THREE.PlaneGeometry(
            this.trackDimensions.width, 
            this.trackDimensions.length, 
            40, 40 // Higher resolution grid
        );
        
        // Use a bright hot pink material that's unmistakable
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF1493, // Hot Pink
            emissive: 0xFF1493, // Same hot pink for glow
            emissiveIntensity: 0.8, // High intensity for better visibility
            wireframe: true,
            opacity: 0.9,
            transparent: true,
            side: THREE.DoubleSide,
            wireframeLinewidth: 3 // Note: not supported in WebGL but worth trying
        });
        
        const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        floorMesh.rotation.x = Math.PI / 2; // Rotate to be horizontal
        floorMesh.position.set(0, this.groundLevel + 0.1, 0); // Slightly above ground level
        this.scene.add(floorMesh);
        
        // Store a reference to this mesh for later position updates
        this.floorMesh = floorMesh;
        
        // Add large markers at cardinal points on floor grid for better orientation
        this.addFloorMarker(this.trackDimensions.width/2, this.groundLevel + 0.2, 0, 0xFF0000); // East - Red
        this.addFloorMarker(-this.trackDimensions.width/2, this.groundLevel + 0.2, 0, 0x00FF00); // West - Green
        this.addFloorMarker(0, this.groundLevel + 0.2, this.trackDimensions.length/2, 0x0000FF); // North - Blue
        this.addFloorMarker(0, this.groundLevel + 0.2, -this.trackDimensions.length/2, 0xFFFF00); // South - Yellow
        this.addFloorMarker(0, this.groundLevel + 0.2, 0, 0xFFFFFF); // Center - White
        
        console.log('Created hot pink floor at ground level: ' + this.groundLevel);
    }
    
    /**
     * Add a marker to help orient on the floor grid
     */
    addFloorMarker(x, y, z, color) {
        // Create a sphere marker
        const markerGeometry = new THREE.SphereGeometry(5, 16, 16);
        const markerMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.0
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(x, y, z);
        this.scene.add(marker);
        
        // Add a spotlight to illuminate the marker
        const spotLight = new THREE.SpotLight(color, 2);
        spotLight.position.set(x, y + 20, z);
        spotLight.target = marker;
        spotLight.angle = Math.PI / 6;
        spotLight.penumbra = 0.2;
        spotLight.decay = 1;
        spotLight.distance = 100;
        this.scene.add(spotLight);
        this.lights.push(spotLight);
        
        return marker;
    }
    
    /**
     * Create boundaries around the track to prevent falling off
     * @param {Number} centerX - X coordinate of track center
     * @param {Number} centerZ - Z coordinate of track center
     * @param {Number} trackWidth - Half-width of the track
     * @param {Number} trackLength - Half-length of the track
     */
    createTrackBoundaries(centerX, centerZ, trackWidth, trackLength) {
        const wallHeight = 20; // Taller walls
        const wallThickness = 5;
        
        // Create walls - North, East, South, West
        const createWall = (x, z, width, depth) => {
            const wallShape = new CANNON.Box(new CANNON.Vec3(width/2, wallHeight/2, depth/2));
            const wallBody = new CANNON.Body({ mass: 0 });
            wallBody.addShape(wallShape);
            wallBody.position.set(x, wallHeight/2, z);
            this.world.addBody(wallBody);
            this.walls.push(wallBody);
            
            // Add debug visualization if enabled
            if (this.debugEnabled) {
                const wallGeometry = new THREE.BoxGeometry(width, wallHeight, depth);
                const wallMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0x00ff00,
                    transparent: true,
                    opacity: 0.3,
                    wireframe: true
                });
                const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
                wallMesh.position.copy(wallBody.position);
                this.scene.add(wallMesh);
                this.debugMeshes.push(wallMesh);
            }
        };
        
        // North wall (positive z)
        createWall(centerX, centerZ + trackLength, trackWidth * 2, wallThickness);
        
        // South wall (negative z)
        createWall(centerX, centerZ - trackLength, trackWidth * 2, wallThickness);
        
        // East wall (positive x)
        createWall(centerX + trackWidth, centerZ, wallThickness, trackLength * 2);
        
        // West wall (negative x)
        createWall(centerX - trackWidth, centerZ, wallThickness, trackLength * 2);
    }
    
    /**
     * Create ramps for the track
     */
    createRamps() {
        // Define ramp positions and properties
        const rampConfigs = [
            // North - Red Ramp - at the front of the track
            {
                position: { x: 0, y: 0, z: 140 },
                rotation: { x: 0, y: Math.PI, z: 0 },
                size: { width: 40, height: 15, depth: 40 },
                color: 0xff0000, // Red
                visible: this.rampVisibility.north
            },
            // East - Green Ramp - at the right of the track
            {
                position: { x: 140, y: 0, z: 0 },
                rotation: { x: 0, y: Math.PI * 1.5, z: 0 },
                size: { width: 40, height: 15, depth: 40 },
                color: 0x00ff00, // Green
                visible: this.rampVisibility.east
            },
            // South - Blue Ramp - at the back of the track
            {
                position: { x: 0, y: 0, z: -140 },
                rotation: { x: 0, y: 0, z: 0 },
                size: { width: 40, height: 15, depth: 40 },
                color: 0x0000ff, // Blue
                visible: this.rampVisibility.south
            },
            // West - Yellow Ramp - at the left of the track
            {
                position: { x: -140, y: 0, z: 0 },
                rotation: { x: 0, y: Math.PI * 0.5, z: 0 },
                size: { width: 40, height: 15, depth: 40 },
                color: 0xffff00, // Yellow
                visible: this.rampVisibility.west
            }
        ];
        
        // Create each ramp
        for (const config of rampConfigs) {
            if (config.visible) {
                this.createRamp(config);
            }
        }
    }
    
    /**
     * Create a ramp at the specified position with the specified properties
     * @param {Object} options - Ramp options
     */
    createRamp(options) {
        // Extract options with defaults
        const {
            position = { x: 0, y: 0, z: 0 },
            rotation = { x: 0, y: 0, z: 0 },
            size = { width: 20, height: 10, depth: 30 },
            color = 0xff0000,
            mass = 0
        } = options;
        
        // Get the hex color name for debugging
        const colorName = this.getColorName(color);
        
        console.log(`Creating ${colorName} ramp at (${position.x}, ${position.y}, ${position.z})`);
        
        // Create visual mesh for the ramp
        
        // Box geometry for the ramp
        const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
        
        // Material with emissive component for better visibility
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.4,
            metalness: 0.6,
            side: THREE.DoubleSide
        });
        
        // Create mesh and position it
        const rampMesh = new THREE.Mesh(geometry, material);
        
        // Position the ramp at ground level plus half height to sit on ground
        // IMPORTANT: Use this.groundLevel which is -20 to match the track and height map
        const rampY = this.groundLevel + (size.height / 2);
        rampMesh.position.set(position.x, rampY, position.z);
        
        // Apply rotation
        rampMesh.rotation.set(rotation.x, rotation.y, rotation.z);
        
        // Add to scene
        this.scene.add(rampMesh);
        this.rampMeshes.push(rampMesh);
        
        console.log(`Added ${colorName} ramp visual mesh at y=${rampY}`);
        
        // Create physics body for the ramp at the same position
        const rampBody = new CANNON.Body({
            mass: mass,
            position: new CANNON.Vec3(position.x, rampY, position.z),
            shape: new CANNON.Box(new CANNON.Vec3(size.width / 2, size.height / 2, size.depth / 2))
        });
        
        // Apply rotation to physics body
        const quaternion = new CANNON.Quaternion();
        quaternion.setFromEuler(rotation.x, rotation.y, rotation.z, 'XYZ');
        rampBody.quaternion.copy(quaternion);
        
        // Add to physics world
        this.world.addBody(rampBody);
        this.ramps.push(rampBody);
        
        console.log(`Added ${colorName} ramp physics body at y=${rampY}`);
        
        // Add a spotlight to illuminate the ramp
        const spotLight = new THREE.SpotLight(color, 2);
        spotLight.position.set(position.x, rampY + 40, position.z); // Position light above the ramp
        spotLight.target = rampMesh;
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.2;
        spotLight.decay = 1;
        spotLight.distance = 100;
        spotLight.castShadow = true;
        this.scene.add(spotLight);
        this.lights.push(spotLight);
        
        console.log(`Added spotlight for ${colorName} ramp`);
    }
    
    /**
     * Create checkpoints for the track
     * This implementation adds checkpoints to detect lap completion
     */
    createCheckpoints() {
        console.log('Creating checkpoints for track');
        
        // Define checkpoint positions around the track
        const checkpointSpacing = 100; // Gap between checkpoints
        const checkpointHeight = 40; // Height of checkpoint gate
        
        // Define the checkpoints to create
        const checkpoints = [
            // Start/Finish line
            {
                position: { x: 0, y: 5, z: checkpointSpacing },
                size: { width: 60, height: checkpointHeight, depth: 1 },
                color: 0xffffff,
                name: 'start_finish',
                index: 0
            },
            // Checkpoint 1
            {
                position: { x: checkpointSpacing, y: 5, z: 0 },
                size: { width: 60, height: checkpointHeight, depth: 1 },
                rotation: { x: 0, y: Math.PI / 2, z: 0 },
                color: 0x00ffff,
                name: 'checkpoint_1',
                index: 1
            },
            // Checkpoint 2
            {
                position: { x: 0, y: 5, z: -checkpointSpacing },
                size: { width: 60, height: checkpointHeight, depth: 1 },
                color: 0xff00ff,
                name: 'checkpoint_2', 
                index: 2
            },
            // Checkpoint 3
            {
                position: { x: -checkpointSpacing, y: 5, z: 0 },
                size: { width: 60, height: checkpointHeight, depth: 1 },
                rotation: { x: 0, y: Math.PI / 2, z: 0 },
                color: 0xffff00,
                name: 'checkpoint_3',
                index: 3
            }
        ];
        
        // Create the checkpoints
        for (const checkpoint of checkpoints) {
            this.createCheckpoint(checkpoint);
        }
    }
    
    /**
     * Create a checkpoint on the track
     * @param {Object} options - Checkpoint options
     */
    createCheckpoint(options) {
        const {
            position = { x: 0, y: 0, z: 0 },
            rotation = { x: 0, y: 0, z: 0 },
            size = { width: 40, height: 40, depth: 1 },
            color = 0xffff00,
            name = 'checkpoint',
            index = 0
        } = options;
        
        // Calculate Y position based on groundLevel
        const yPosition = this.groundLevel + position.y; // Position relative to ground level
        
        // Create checkpoint mesh
        const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, yPosition, position.z); // Position at correct ground level
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);
        mesh.name = name;
        this.scene.add(mesh);
        
        // Add a spotlight to illuminate the checkpoint
        const spotLight = new THREE.SpotLight(color, 1);
        spotLight.position.set(position.x, yPosition + 20, position.z); // Position light above checkpoint
        spotLight.target = mesh;
        spotLight.angle = Math.PI / 6;
        spotLight.penumbra = 0.2;
        spotLight.decay = 1;
        spotLight.distance = 100;
        this.scene.add(spotLight);
        this.lights.push(spotLight);
        
        // Create checkpoint data
        const checkpoint = {
            mesh: mesh,
            position: { x: position.x, y: yPosition, z: position.z }, // Store actual position
            rotation: rotation,
            size: size,
            color: color,
            name: name,
            index: index
        };
        
        this.checkpoints.push(checkpoint);
        
        console.log(`Created checkpoint '${name}' at (${position.x}, ${yPosition}, ${position.z})`);
        
        return checkpoint;
    }
    
    /**
     * Get the player start position for this track
     * @returns {Object} - The player start position and rotation
     */
    getPlayerStartPosition() {
        // Place the player at a safe starting position on top of the track
        // Using position similar to DriftRaceTrack for consistent camera behavior
        return {
            position: { 
                x: 0, 
                y: 3, // Lower height to ensure ATV is closer to ground
                z: -10  // Start slightly behind center to be closer to camera
            },
            rotation: { x: 0, y: 0, z: 0, w: 1 }
        };
    }
    
    /**
     * Toggle the height map visualization overlay separately from debug elements
     * @param {boolean} show - Whether to show the height map overlay
     */
    toggleHeightMapOverlay(show) {
        this.showHeightMapOverlay = show;
        
        if (this.heightMapMesh) {
            this.heightMapMesh.visible = show;
            
            console.log(`Height map overlay ${show ? 'enabled' : 'disabled'}`);
        }
    }
    
    /**
     * Enable or disable debug visualizations
     * @param {boolean} enabled - Whether to enable debug visualizations
     */
    toggleDebug(enabled) {
        this.debugEnabled = enabled;
        
        // Toggle visibility of debug elements
        if (this.debugWalls) {
            this.debugWalls.visible = enabled;
        }
        
        if (this.debugBoundary) {
            this.debugBoundary.visible = enabled;
        }
        
        // Height map visualization is controlled separately by toggleHeightMapOverlay
        // so we don't modify it here to respect user preferences
    }
    
    /**
     * Override the cleanup method to also clean up height map resources
     */
    cleanup() {
        // Call the parent cleanup method first
        super.cleanup();
        
        // Clean up height map resources
        if (this.heightMapMesh) {
            this.scene.remove(this.heightMapMesh);
            this.heightMapMesh.geometry.dispose();
            this.heightMapMesh.material.dispose();
            this.heightMapMesh = null;
        }
        
        if (this.heightfieldBody) {
            this.world.removeBody(this.heightfieldBody);
            this.heightfieldBody = null;
        }
        
        // Clean up track-specific materials
        this.trackMaterial = null;
        
        console.log('Cleaned up Milton MX track height map resources');
    }
    
    /**
     * Get a friendly name for common colors
     * @param {number} color - The hex color value
     * @returns {string} A friendly name for the color or the hex string
     */
    getColorName(color) {
        const colorMap = {
            0xFF0000: 'Red',
            0x00FF00: 'Green', 
            0x0000FF: 'Blue',
            0xFFFF00: 'Yellow',
            0xFF1493: 'Hot Pink',
            0xFFA500: 'Orange',
            0x800080: 'Purple',
            0x00FFFF: 'Cyan',
            0xFF00FF: 'Magenta'
        };
        
        return colorMap[color] || `#${color.toString(16).padStart(6, '0')}`;
    }
    
    /**
     * Update the track state
     * @param {number} deltaTime - The time elapsed since the last update
     */
    update(deltaTime) {
        // Call parent update first
        super.update(deltaTime);
        
        // If we have a vehicle, update our actualGroundLevel to match its position
        if (this.vehicle && this.heightMapMesh && !this.heightMapPositionUpdated) {
            // Get the vehicle position
            const vehicleY = this.vehicle.chassisBody.position.y;
            
            // Check if we need to update the position (if there's a significant difference)
            if (Math.abs(vehicleY - 2 - this.groundLevel) > 1) {
                // Update our actualGroundLevel based on the vehicle position
                this.actualGroundLevel = vehicleY - 2; // Adjust to be slightly below the vehicle
                
                // Force an update to the ground level too
                this.groundLevel = this.actualGroundLevel;
                
                // Move all our debug visualizations to match
                this.updateHeightMapPosition();
                
                console.log(`Updated height map position to match vehicle at y=${vehicleY}, ground=${this.actualGroundLevel}`);
            }
            
            // Only check this once after the vehicle is fully loaded
            this.heightMapPositionUpdated = true;
        }
    }
    
    /**
     * Update the height map position to match the actual ground level
     */
    updateHeightMapPosition() {
        if (this.heightMapMesh) {
            // Update the height map mesh position
            this.heightMapMesh.position.y = this.actualGroundLevel;
            
            // Find and update all our debug visualization objects
            this.scene.traverse((object) => {
                // Check if this is one of our debug objects (has a specific property or material color)
                if (object.isMesh && object.material && 
                    (object.material.color && object.material.color.r > 0.9 && 
                     object.material.color.g < 0.2 && object.material.color.b > 0.5)) {
                    // This is likely our hot pink floor - adjust its Y position
                    if (object !== this.heightMapMesh && object.position.y > -10 && object.position.y < 10) {
                        object.position.y = this.actualGroundLevel + 0.2;
                    }
                }
            });
            
            // Update the spotlight positions too
            this.lights.forEach(light => {
                if (light.isSpotLight && (light.color.r > 0.9 && light.color.g < 0.2 && light.color.b > 0.5)) {
                    // This is a hot pink spotlight - adjust its target position
                    if (light.target) {
                        const targetYDelta = light.target.position.y - this.groundLevel;
                        light.target.position.y = this.actualGroundLevel + targetYDelta;
                    }
                }
            });
            
            console.log(`Moved all hot pink debug visualizations to actual ground level: ${this.actualGroundLevel}`);
        }
    }
    
    /**
     * Initialize the track
     */
    initialize() {
        console.log(`Initializing ${this.name}`);
        
        // Create the scene and physics world
        this.scene = new THREE.Scene();
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        
        // Set up a white ambient light to ensure everything is visible
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Load the track model
        if (this.modelPath) {
            const loader = new GLTFLoader();
            loader.load(this.modelPath, (gltf) => {
                console.log('Track model loaded successfully', gltf);
                
                this.trackMesh = gltf.scene;
                this.scene.add(this.trackMesh);
                
                if (this.trackMesh) {
                    // Apply scale to the track model
                    this.trackMesh.scale.set(this.modelScale, this.modelScale, this.modelScale);
                    
                    // Position the track model at the ground level (-20) to match the height map and ATV
                    this.trackMesh.position.set(0, this.groundLevel, 0);
                    
                    // Traverse the model to adjust all children as well
                    this.trackMesh.traverse((child) => {
                        if (child.isMesh) {
                            // Ensure all child meshes are visible and receive shadows
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    // Extract dimensions from model for reference
                    console.log(`Scaling track model by factor: ${this.modelScale}`);
                    
                    // Compute the track dimensions based on the loaded model
                    const bbox = new THREE.Box3().setFromObject(this.trackMesh);
                    const size = bbox.getSize(new THREE.Vector3());
                    
                    // Update the track dimensions
                    this.trackDimensions = {
                        width: size.x,
                        length: size.z,
                        height: size.y
                    };
                    
                    console.log(`Track dimensions: ${size.x.toFixed(2)} x ${size.z.toFixed(2)} x ${size.y.toFixed(2)}`);
                    
                    // Create the physics body for the track
                    if (this.useHeightMap) {
                        console.log('Creating height map physics');
                        this.createHeightMapPhysics(this.trackMesh);
                    } else {
                        console.log('Creating flat physics plane');
                        this.createFlatPhysics();
                    }
                    
                    // Setup ramps after the track is loaded
                    this.createRamps();
                    
                    // Create checkpoints around the track
                    this.createCheckpoints();
                    
                    // Create a hot pink floor visualization for debugging
                    if (this.showHeightMapOverlay) {
                        this.createHotPinkFloor();
                    }
                    
                    // Setup track walls if needed
                    if (this.needsWalls) {
                        this.createWalls();
                    }
                    
                    // Call the track loaded event
                    if (this.onTrackLoaded) {
                        this.onTrackLoaded();
                    }
                }
            }, undefined, (error) => {
                console.error('Error loading track model:', error);
            });
        } else {
            console.warn('No track model specified');
            
            // Create physics even without a model
            if (this.useHeightMap) {
                this.createHeightMapPhysics();
            } else {
                this.createFlatPhysics();
            }
            
            // Setup track components
            this.createRamps();
            this.createCheckpoints();
            
            if (this.needsWalls) {
                this.createWalls();
            }
            
            // Call the track loaded event
            if (this.onTrackLoaded) {
                this.onTrackLoaded();
            }
        }
    }
}

export default MiltonMXTrack;
