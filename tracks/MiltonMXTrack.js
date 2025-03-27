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
        
        // Scale factor for the track model
        this.modelScale = 40.0; // Match the multiplier used for physics dimensions
        
        // User preferences for which ramps to show
        this.rampVisibility = {
            north: false,  // red ramp
            east: false,   // green ramp
            south: true,   // blue ramp - only this one should be visible based on user preferences
            west: false    // yellow ramp
        };
        
        // Height map settings
        this.useHeightMap = true;
        this.heightMapResolution = 256; // Increased resolution for better detail
        this.heightMapMesh = null;
        this.heightfieldBody = null;
        
        // Track-specific physics properties
        this.trackFriction = 0.1;  // Lower friction for faster movement
        this.trackRestitution = 0.1; // Lower restitution for less bouncing
        
        // Track-specific vehicle settings
        this.vehicleSettings = {
            speed: 4000,         // Reduced from 5000 to make it more controllable
            turnSpeed: 1.0,      // Reduced from 1.5 to make turning less aggressive
            maxEngineForce: 12000, // Reduced from 15000 for better control
            rollInfluence: 0.01,  // Increased from 0.005 for better stability
            suspensionStiffness: 35, // Increased from 30 for better handling
            dampingRelaxation: 2.5, // Increased from 2.3 for better stability
            dampingCompression: 4.6, // Increased from 4.4 for better stability
            linearDamping: 0.05,   // Increased from 0.01 to reduce excessive speed
            angularDamping: 0.2,    // Increased from 0.1 to reduce excessive turning
            // Add a small right bias to counteract the left turning issue
            rightBias: 0.05      // New parameter to counteract left turning bias
        };
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
                    
                    // Scale and position the track - using the defined scale factor
                    this.trackMesh.scale.set(this.modelScale, this.modelScale, this.modelScale);
                    this.trackMesh.position.set(0, 0, 0); // Set to origin, physics will be positioned accordingly
                    
                    console.log(`Scaling track model by factor: ${this.modelScale}`);
                    
                    // Log the structure of the loaded model for debugging
                    this.logModelStructure(this.trackMesh);
                    
                    // Add the track to the scene
                    this.scene.add(this.trackMesh);
                    
                    // Create physics for the track
                    this.createPhysics();
                    
                    // Add ramps and other track features
                    this.createRamps();
                    
                    // Modify vehicle physics for this track
                    this.adjustVehiclePhysics();
                    
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
     * Create physics for the track
     * This implementation creates a physics representation based on the track's geometry
     */
    createPhysics() {
        // Calculate the bounding box of the track model to determine its dimensions
        this.trackDimensions = this.computeBoundingBox(this.trackMesh);
        
        // Find the terrain mesh for height map generation
        let terrainMesh = null;
        this.trackMesh.traverse((child) => {
            if (child.isMesh) {
                // Look for the main terrain mesh - typically the largest mesh with "material0_0" in the name
                if (child.name.includes('material0_0')) {
                    terrainMesh = child;
                    console.log(`Found terrain mesh for height map: ${child.name}`);
                }
            }
        });
        
        // Create physics based on the height map if enabled and terrain mesh is found
        if (this.useHeightMap && terrainMesh) {
            console.log('Using height map physics with specific terrain mesh');
            this.createHeightMapPhysics(terrainMesh);
        } else if (this.useHeightMap) {
            console.log('Using height map physics with entire track mesh');
            this.createHeightMapPhysics(this.trackMesh);
        } else {
            // Fallback to flat ground plane
            console.log('Falling back to flat physics (height map disabled)');
            this.createFlatPhysics();
        }
        
        // Create walls around the track - using the track dimensions
        const halfWidth = this.trackDimensions.width / 2;
        const halfLength = this.trackDimensions.length / 2;
        this.createTrackBoundaries(0, 0, halfWidth, halfLength);
        
        // Log the track dimensions for debugging
        console.log(`Track dimensions: Width=${this.trackDimensions.width}, Length=${this.trackDimensions.length}, Height Range=${this.trackDimensions.minY} to ${this.trackDimensions.maxY}`);
    }
    
    /**
     * Create physics using a height map generated from the terrain mesh
     * @param {THREE.Object3D} terrainMesh - The mesh to use for height map generation
     */
    createHeightMapPhysics(terrainMesh) {
        console.log('Creating physics using height map from terrain mesh');
        
        // Generate the height map
        const heightMap = HeightMapGenerator.generateFromMesh(terrainMesh, {
            resolution: this.heightMapResolution,
            width: this.trackDimensions.width,
            length: this.trackDimensions.length
        });
        
        if (!heightMap) {
            console.error('Failed to generate height map, falling back to flat physics');
            this.createFlatPhysics();
            return;
        }
        
        console.log(`Height map generated with range: ${heightMap.minHeight} to ${heightMap.maxHeight}`);
        
        // If the height range is too small, the terrain is likely flat
        if (Math.abs(heightMap.maxHeight - heightMap.minHeight) < 0.1) {
            console.warn('Height map has very small height range, terrain may be flat');
        }
        
        // Create the heightfield body
        this.heightfieldBody = HeightMapGenerator.createHeightfieldBody(heightMap, this.world);
        
        // Adjust the heightfield position to ensure it aligns with the visual mesh
        // This is critical to prevent the ATV from floating above the ground
        if (this.heightfieldBody) {
            // Adjust the Y position to ensure the terrain is at ground level
            this.heightfieldBody.position.y = -2; // Lower the heightfield to match the visual ground
            console.log(`Adjusted heightfield position to y=${this.heightfieldBody.position.y}`);
        }
        
        this.trackCollider = this.heightfieldBody;
        
        // Create a visualization of the height map if debug is enabled
        if (this.debugEnabled) {
            const heightMapMesh = HeightMapGenerator.createHeightMapVisualization(heightMap, this.scene);
            if (heightMapMesh) {
                this.heightMapMesh = heightMapMesh;
                this.debugMeshes.push(heightMapMesh);
            }
        }
        
        console.log('Height map physics created successfully');
    }
    
    /**
     * Create flat physics as a fallback
     */
    createFlatPhysics() {
        console.log('Creating flat physics for the track');
        
        // Create a flat ground plane for the physics
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Rotate to be flat
        groundBody.position.set(0, 0, 0); // Position at y=0
        this.world.addBody(groundBody);
        this.trackCollider = groundBody;
        
        // Create additional flat platforms at different heights to better match the terrain
        const platformWidth = this.trackDimensions.width;
        const platformLength = this.trackDimensions.length;
        this.createFlatPlatform(0, 10, 0, platformWidth, platformLength);  // Main platform
    }
    
    /**
     * Create a flat platform at the specified position
     * @param {Number} x - X position
     * @param {Number} y - Y position
     * @param {Number} z - Z position
     * @param {Number} width - Width of the platform
     * @param {Number} depth - Depth of the platform
     */
    createFlatPlatform(x, y, z, width, depth) {
        const platformShape = new CANNON.Box(new CANNON.Vec3(width/2, 0.5, depth/2));
        const platformBody = new CANNON.Body({ mass: 0 });
        platformBody.addShape(platformShape);
        platformBody.position.set(x, y, z);
        this.world.addBody(platformBody);
        
        // Add to walls array for cleanup
        this.walls.push(platformBody);
        
        // Add debug visualization if enabled
        if (this.debugEnabled) {
            const platformGeometry = new THREE.BoxGeometry(width, 1, depth);
            const platformMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                transparent: true,
                opacity: 0.3,
                wireframe: true
            });
            const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
            platformMesh.position.copy(platformBody.position);
            this.scene.add(platformMesh);
            this.debugMeshes.push(platformMesh);
        }
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
        // Add ramps with different colors - but only make them visible based on user preferences
        
        // South ramp (blue) - This is the only one that should be visible based on user preferences
        if (this.rampVisibility.south) {
            // Position the ramp on the track surface
            const rampX = 0;
            const rampZ = -100;
            const rampY = 5; // Position at a reasonable height
            
            this.createRamp(rampX, rampZ, 40, 15, 50, Math.PI/12, 'z', 0x0000FF);
        }
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
     * Create a ramp on the track
     * @param {Number} x - X position
     * @param {Number} z - Z position
     * @param {Number} width - Width of the ramp
     * @param {Number} height - Height of the ramp
     * @param {Number} depth - Depth of the ramp
     * @param {Number} angle - Angle of inclination in radians
     * @param {String} axis - Rotation axis ('x' or 'z')
     * @param {Number} color - Color as a hex value
     * @returns {Object} Object containing the ramp body and mesh
     */
    createRamp(x, z, width, height, depth, angle, axis, color) {
        // Create the physics body - position is key for a smooth transition
        const rampBody = new CANNON.Body({ mass: 0 });
        const rampShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
        
        // Calculate the vertical offset to make the edge flush with the ground
        const verticalOffset = Math.sin(angle) * depth / 2;
        
        // Add the shape with an offset to make the transition smooth
        rampBody.addShape(rampShape);
        
        // Position the ramp
        rampBody.position.set(x, verticalOffset + height/2, z);
        
        // Rotate the ramp based on the specified axis
        if (axis === 'x') {
            rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), angle);
        } else {
            rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
        }
        
        this.world.addBody(rampBody);
        this.walls.push(rampBody);
        
        // Create a visual representation of the ramp
        const rampGeometry = new THREE.BoxGeometry(width, height, depth);
        const rampMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.5,
            metalness: 0.5
        });
        
        const rampMesh = new THREE.Mesh(rampGeometry, rampMaterial);
        
        // Position and rotate the visual mesh to match the physics body
        rampMesh.position.copy(rampBody.position);
        rampMesh.quaternion.copy(rampBody.quaternion);
        
        this.scene.add(rampMesh);
        this.debugMeshes.push(rampMesh);
        
        // Add a spotlight to highlight the ramp
        const spotlight = new THREE.SpotLight(color, 1);
        spotlight.position.set(x, 50, z);
        spotlight.target.position.set(x, 0, z);
        spotlight.angle = Math.PI / 6;
        spotlight.penumbra = 0.5;
        spotlight.distance = 100;
        spotlight.castShadow = true;
        this.scene.add(spotlight);
        this.scene.add(spotlight.target);
        this.debugMeshes.push(spotlight);
        
        return { body: rampBody, mesh: rampMesh };
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
}

export default MiltonMXTrack;
