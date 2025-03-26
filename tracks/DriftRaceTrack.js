/**
 * DriftRaceTrack.js - Implementation of the drift race track
 * Extends the BaseTrack class to provide specific track implementations
 */

import BaseTrack from './BaseTrack.js';

/**
 * Drift Race Track - implements a specific track type
 */
class DriftRaceTrack extends BaseTrack {
    constructor(options) {
        super(options);
        this.name = 'Drift Race Track';
        this.modelPath = 'models/tracks/drift_race_track.glb';
        this.debugEnabled = false;
        
        // User preferences for which ramps to show
        this.rampVisibility = {
            north: true,  // red ramp
            east: true,   // green ramp
            south: true,   // blue ramp - only this one should be visible
            west: true    // yellow ramp
        };
    }
    
    /**
     * Load the track
     * @returns {Promise} - A promise that resolves when the track is loaded
     */
    async load() {
        console.log(`Loading drift race track model: ${this.modelPath}`);
        
        // Create a promise to handle the asynchronous loading
        return new Promise((resolve, reject) => {
            // Load the model using THREE.GLTFLoader
            const loader = new THREE.GLTFLoader();
            loader.load(
                this.modelPath,
                (gltf) => {
                    this.trackMesh = gltf.scene;
                    
                    // Scale and position the track
                    this.trackMesh.scale.set(5, 5, 5);
                    this.trackMesh.position.set(0, -1, 0);
                    
                    // Add the track to the scene
                    this.scene.add(this.trackMesh);
                    
                    // Create physics for the track
                    this.createPhysics();
                    
                    // Add ramps and other track features
                    this.createRamps();
                    
                    console.log('Drift race track loaded successfully');
                    resolve(this);
                },
                (xhr) => {
                    // Progress callback
                    console.log(`${(xhr.loaded / xhr.total * 100).toFixed(0)}% loaded`);
                },
                (xhr) => {
                    // Error callback
                    console.error('Error loading drift race track:', xhr);
                    reject(xhr);
                }
            );
        });
    }
    
    /**
     * Create ramps for the track
     */
    createRamps() {
        // Add ramps with different colors - but only make them visible based on user preferences
        
        // North ramp (red)
        if (this.rampVisibility.north) {
            this.createRamp(0, 680, 40, 15, 50, Math.PI/12, 'x', 0xFF0000);
        }
        
        // East ramp (green)
        if (this.rampVisibility.east) {
            this.createRamp(150, 220, 30, 15, 50, Math.PI/12, 'z', 0x00FF00);
        }
        
        // South ramp (blue) - This is the only one that should be visible
        if (this.rampVisibility.south) {
            this.createRamp(0, -500, 40, 15, 50, Math.PI/12, 'z', 0x0000FF);
        }
        
        // West ramp (yellow)
        if (this.rampVisibility.west) {
            this.createRamp(-50, -50, 30, 15, 50, Math.PI/12, 'z', 0xFFFF00);
        }
        
        // Portal ramp - keeping this one visible as it's part of the game mechanics
        this.createPortalRamp(-200, -250, 45, 5, 60, Math.PI/12, 2, 0x8A2BE2); // Purple
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
        const rampBody = new CANNON.Body({ mass: 0, material: this.materials.ground });
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
        this.world.addBody(rampBody);
        this.ramps.push(rampBody);
        
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
        
        this.scene.add(rampMesh);
        this.rampMeshes.push(rampMesh);
        
        // Add spotlight for better visibility
        const spotLight = new THREE.SpotLight(color, 1.5);
        spotLight.position.set(x, 30, z);
        spotLight.target = rampMesh;
        spotLight.angle = Math.PI / 6;
        spotLight.penumbra = 0.2;
        spotLight.distance = 100;
        this.scene.add(spotLight);
        this.lights.push(spotLight);
        
        return { body: rampBody, mesh: rampMesh };
    }
    
    /**
     * Create a portal ramp with custom parameters
     * @param {Number} x - X position
     * @param {Number} z - Z position 
     * @param {Number} width - Width of the ramp
     * @param {Number} height - Height of the ramp
     * @param {Number} depth - Depth of the ramp
     * @param {Number} angle - Angle of inclination in radians
     * @param {Number} elevation - Height off the ground
     * @param {Number} color - Color as a hex value
     * @returns {Object} The ramp object with body and mesh
     */
    createPortalRamp(x, z, width, height, depth, angle, elevation, color) {
        // Create the physics body with raised position
        const rampBody = new CANNON.Body({ mass: 0, material: this.materials.ground });
        const rampShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
        rampBody.addShape(rampShape);
        
        // Position with specified elevation off the ground
        const yPos = elevation + height/2;
        rampBody.position.set(x, yPos, z);
        
        // Apply rotation on x-axis
        const rotationAxis = new CANNON.Vec3(1, 0, 0);
        rampBody.quaternion.setFromAxisAngle(rotationAxis, angle);
        this.world.addBody(rampBody);
        this.ramps.push(rampBody);
        
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
        
        this.scene.add(rampMesh);
        this.rampMeshes.push(rampMesh);
        
        // Add spotlight for better visibility
        const spotLight = new THREE.SpotLight(color, 1.5);
        spotLight.position.set(x, 30, z);
        spotLight.target = rampMesh;
        spotLight.angle = Math.PI / 6;
        spotLight.penumbra = 0.2;
        spotLight.distance = 100;
        this.scene.add(spotLight);
        this.lights.push(spotLight);
        
        return { body: rampBody, mesh: rampMesh };
    }
    
    /**
     * Create physics bodies for the track
     */
    createPhysics() {
        console.log("Creating physics for drift race track");
        
        // Create main track body
        const trackPhysicsBody = new CANNON.Body({
            mass: 0,
            material: this.materials.ground
        });
        
        // These variables will store the bounding box of the track to help us create physics
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        // Traverse the model to find its bounding box dimensions
        this.trackMesh.traverse((child) => {
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
        
        // Calculate track dimensions from the actual bounding box
        // Expand the size by a multiplier to ensure it covers the visual area
        const sizeMultiplier = 5.0;
        const trackWidth = (maxX - minX) / 2 * sizeMultiplier;
        const trackLength = (maxZ - minZ) / 2 * sizeMultiplier;
        const trackHeight = 1;  // Keep this relatively thin
        
        // Calculate the center position
        const centerX = (maxX + minX) / 2;
        const centerZ = (maxZ + minZ) / 2;
        const centerY = minY; // Use the bottom of the track as the y-position
        
        // Create a main platform as a base collider
        const baseShape = new CANNON.Box(new CANNON.Vec3(trackWidth, trackHeight, trackLength));
        trackPhysicsBody.addShape(baseShape);
        
        // Position the track collider at the calculated center
        trackPhysicsBody.position.set(centerX, centerY, centerZ);
        this.world.addBody(trackPhysicsBody);
        this.trackCollider = trackPhysicsBody;
        
        // Create walls around the track
        this.createWalls(centerX, centerY, centerZ, trackWidth, trackLength, sizeMultiplier, minX, maxX, minZ, maxZ);
        
        // Create debug visualization if enabled
        if (this.debugEnabled) {
            this.createDebugVisuals(trackWidth, trackHeight, trackLength, trackPhysicsBody.position);
        }
    }
    
    /**
     * Create walls around the track
     */
    createWalls(centerX, centerY, centerZ, trackWidth, trackLength, sizeMultiplier, minX, maxX, minZ, maxZ) {
        const wallHeight = 5;
        const wallThickness = 1;
        
        // Use the expanded bounds for wall placement
        const wallX = maxX * sizeMultiplier;
        const wallZ = maxZ * sizeMultiplier;
        const negWallX = minX * sizeMultiplier;
        const negWallZ = minZ * sizeMultiplier;
        
        // North wall (Z max)
        const northWallShape = new CANNON.Box(new CANNON.Vec3(trackWidth, wallHeight, wallThickness));
        const northWallBody = new CANNON.Body({ mass: 0, material: this.materials.ground });
        northWallBody.addShape(northWallShape);
        northWallBody.position.set(centerX, centerY + wallHeight, wallZ);
        this.world.addBody(northWallBody);
        this.walls.push(northWallBody);
        
        // South wall (Z min)
        const southWallShape = new CANNON.Box(new CANNON.Vec3(trackWidth, wallHeight, wallThickness));
        const southWallBody = new CANNON.Body({ mass: 0, material: this.materials.ground });
        southWallBody.addShape(southWallShape);
        southWallBody.position.set(centerX, centerY + wallHeight, negWallZ);
        this.world.addBody(southWallBody);
        this.walls.push(southWallBody);
        
        // East wall (X max)
        const eastWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness, wallHeight, trackLength));
        const eastWallBody = new CANNON.Body({ mass: 0, material: this.materials.ground });
        eastWallBody.addShape(eastWallShape);
        eastWallBody.position.set(wallX, centerY + wallHeight, centerZ);
        this.world.addBody(eastWallBody);
        this.walls.push(eastWallBody);
        
        // West wall (X min)
        const westWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness, wallHeight, trackLength));
        const westWallBody = new CANNON.Body({ mass: 0, material: this.materials.ground });
        westWallBody.addShape(westWallShape);
        westWallBody.position.set(negWallX, centerY + wallHeight, centerZ);
        this.world.addBody(westWallBody);
        this.walls.push(westWallBody);
    }
    
    /**
     * Create debug visualization for the track physics
     */
    createDebugVisuals(trackWidth, trackHeight, trackLength, position) {
        // Create a debug visual to see the physics shape
        const debugGeometry = new THREE.BoxGeometry(trackWidth * 2, trackHeight * 2, trackLength * 2);
        const debugMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            wireframe: true,
            opacity: 0.5,
            transparent: true
        });
        const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
        debugMesh.position.copy(position);
        debugMesh.visible = this.debugEnabled;
        this.scene.add(debugMesh);
        this.debugMeshes.push(debugMesh);
        
        // Also create debug visualizations for the walls
        this.walls.forEach(wall => {
            const shape = wall.shapes[0];
            const wallGeometry = new THREE.BoxGeometry(
                shape.halfExtents.x * 2,
                shape.halfExtents.y * 2,
                shape.halfExtents.z * 2
            );
            const wallMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00, 
                wireframe: true,
                opacity: 0.3,
                transparent: true
            });
            const wallDebug = new THREE.Mesh(wallGeometry, wallMaterial);
            wallDebug.position.copy(wall.position);
            wallDebug.visible = this.debugEnabled;
            this.scene.add(wallDebug);
            this.debugMeshes.push(wallDebug);
        });
    }
    
    /**
     * Get the player start position for this track
     */
    getPlayerStartPosition() {
        return {
            position: { x: 20, y: 10, z: 20 },
            rotation: { x: 0, y: 0, z: 0, w: 1 }
        };
    }
    
    /**
     * Set debug visualization state
     */
    setDebugVisible(visible) {
        this.debugEnabled = visible;
        this.debugMeshes.forEach(mesh => {
            mesh.visible = visible;
        });
    }
}

export default DriftRaceTrack;
