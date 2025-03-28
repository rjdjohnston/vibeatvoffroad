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
        this.debugEnabled = false; // Keep debug visualization disabled per user preference
        
        // Track dimensions - large flat plane
        this.trackDimensions = {
            width: 1200,
            length: 1200,
            height: 200
        };
        
        // Height map settings for visualization
        this.useHeightMap = true;
        this.heightMapResolution = 128; // Higher resolution for smoother hills
        this.heightMapData = null;
        this.heightMapMesh = null;
        
        // Hill definitions
        this.hills = [
            { x: 0.3, z: 0.3, height: 50, radius: 0.1, number: 1 },
            { x: -0.3, z: 0.3, height: 40, radius: 0.08, number: 2 },
            { x: 0, z: -0.3, height: 60, radius: 0.12, number: 3 },
            { x: -0.4, z: -0.4, height: 30, radius: 0.07, number: 4 },
            { x: 0.4, z: -0.4, height: 35, radius: 0.09, number: 5 }
        ];
        
        // Hill physics bodies
        this.hillBodies = [];
        
        // Track level settings
        this.groundLevel = -20;
        
        // Track-specific physics properties
        this.trackFriction = 0.3;
        this.trackRestitution = 0.2;
        
        // Initialize arrays for game objects
        this.ramps = [];
        this.rampMeshes = [];
        this.checkpoints = [];
        this.lights = [];
        this.walls = [];
        this.debugMeshes = [];
        this.hillNumbers = [];
    }
    
    /**
     * Get track-specific vehicle settings
     * @returns {Object} Vehicle settings for this track
     */
    getVehicleSettings() {
        return {
            maxSuspensionTravel: 0.3,
            suspensionStiffness: 30,
            suspensionDamping: 4.4,
            suspensionForce: 6000
        };
    }
    
    /**
     * Load the track
     * @returns {Promise} - A promise that resolves when the track is loaded
     */
    load() {
        return new Promise((resolve) => {
            console.log('Loading Milton MX track...');
            
            // Create a height map with multiple hills for jumping
            this.createTerrainHeightMap();
            
            // Create a detailed terrain visualization
            this.createTerrainVisualization();
            
            // Create physics for the track
            this.createPhysics();
            
            // Create ramps and walls
            // this.createRamps();
            this.createWalls();
            
            // Create the hill number markers
            this.createHillNumbers();
            
            console.log('Milton MX track with hills created successfully');
            resolve(this);
        });
    }
    
    /**
     * Create a height map with hills for the track (for visualization)
     */
    createTerrainHeightMap() {
        console.log('Creating terrain height map for Milton MX track');
        
        const resolution = this.heightMapResolution;
        
        // Generate a height map with multiple hills
        this.heightMapData = [];
        
        // Initialize height map with zeros
        for (let i = 0; i < resolution; i++) {
            this.heightMapData[i] = [];
            for (let j = 0; j < resolution; j++) {
                this.heightMapData[i][j] = 0;
            }
        }
        
        // Apply hills to height map
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const x = (i / resolution) * 2 - 1;
                const z = (j / resolution) * 2 - 1;
                
                // Keep edges flat (for safety)
                const edgeDistance = Math.min(
                    Math.abs(x + 1), 
                    Math.abs(x - 1), 
                    Math.abs(z + 1), 
                    Math.abs(z - 1)
                );
                
                // Calculate height based on hills with Gaussian falloff
                let height = 0;
                for (const hill of this.hills) {
                    const dx = x - hill.x;
                    const dz = z - hill.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    // Gaussian falloff
                    const factor = Math.exp(-(distance * distance) / (2 * hill.radius * hill.radius));
                    height += hill.height * factor;
                }
                
                // Apply edge falloff to keep track borders flat
                const edgeFactor = Math.min(1, edgeDistance * 10);
                height *= edgeFactor;
                
                // Update height map
                this.heightMapData[i][j] = Math.max(0, height);
            }
        }
        
        console.log('Terrain height map created with multiple hills');
    }
    
    /**
     * Create physics for the track
     */
    createPhysics() {
        console.log('Creating physics for Milton MX track');
        
        // Create base ground plane
        this.createGroundPlanePhysics();
        
        // Create individual hill collision bodies
        this.createHillPhysics();
    }
    
    /**
     * Create ground plane physics for the track (base level)
     */
    createGroundPlanePhysics() {
        console.log('Creating flat ground physics');
        
        // Create a flat ground plane
        const groundBody = new CANNON.Body({
            mass: 0,
            material: this.materials.ground
        });
        
        // Apply friction and restitution
        if (this.materials && this.materials.ground) {
            this.materials.ground.friction = this.trackFriction;
            this.materials.ground.restitution = this.trackRestitution;
        }
        
        // Use a plane shape
        const groundShape = new CANNON.Plane();
        groundBody.addShape(groundShape);
        
        // Rotate to be horizontal and position at ground level
        groundBody.quaternion.setFromAxisAngle(
            new CANNON.Vec3(1, 0, 0),
            -Math.PI / 2
        );
        groundBody.position.set(0, this.groundLevel, 0);
        
        // Add to physics world
        this.world.addBody(groundBody);
        this.trackCollider = groundBody;
        
        console.log('Flat ground physics created');
    }
    
    /**
     * Create individual hill physics bodies
     */
    createHillPhysics() {
        console.log('Creating smooth cone hill physics bodies');
        
        const { width, length } = this.trackDimensions;
        
        // Clear any existing hill bodies
        this.hillBodies.forEach(body => {
            if (body) this.world.removeBody(body);
        });
        this.hillBodies = [];
        
        // Create smooth cone shapes for each hill for gradual climbing
        for (const hill of this.hills) {
            // Convert normalized coordinates to world coordinates
            const worldX = hill.x * (width / 2);
            const worldZ = hill.z * (length / 2);
            
            // Use cone shape for gradual sloping
            const hillRadius = hill.radius * (width / 2) * 2.0; // Much wider than visual for gentler slope
            const hillHeight = hill.height * 0.6; // Lower height for gentler slope
            
            // Create cone shape for the hill
            const segments = 16; // Number of segments for a rounder approximation
            const hillShape = new CANNON.Cylinder(
                0.1,           // Top radius (almost pointed)
                hillRadius,    // Bottom radius (wide base)
                hillHeight,    // Height
                segments       // Segments
            );
            
            const hillBody = new CANNON.Body({
                mass: 0
            });
            
            // Rotate cone to stand upright (CANNON cylinders are along y-axis by default)
            const quat = new CANNON.Quaternion();
            quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            hillBody.addShape(hillShape, new CANNON.Vec3(0, 0, 0), quat);
            
            // Position the hill body - make sure it's slightly below ground level
            // so the transition from flat ground to hill is smoother
            hillBody.position.set(
                worldX, 
                this.groundLevel + (hillHeight / 2) - 5, // Slightly sunk to smooth transition
                worldZ
            );
            
            // Create a custom material with VERY low friction for the hill
            const hillMaterial = new CANNON.Material('hillMaterial');
            hillMaterial.friction = 0.1; // Very low friction for easier climbing
            hillMaterial.restitution = 0.1; // Minimal bounce
            
            // Apply the material to the hill body
            hillBody.material = hillMaterial;
            
            // Create contact material between hill and vehicle
            if (this.materials && this.materials.wheel) {
                const hillWheelContactMaterial = new CANNON.ContactMaterial(
                    hillMaterial,
                    this.materials.wheel,
                    {
                        friction: 0.2,
                        restitution: 0.1,
                        contactEquationStiffness: 1000
                    }
                );
                this.world.addContactMaterial(hillWheelContactMaterial);
            }
            
            // Add to physics world
            this.world.addBody(hillBody);
            this.hillBodies.push(hillBody);
            
            console.log(`Created smooth cone hill at (${worldX}, ${worldZ}) with radius ${hillRadius} and height ${hillHeight}`);
        }
        
        // Uncomment to re-enable the ramps
        // this.createRamps();
        
        console.log(`Created ${this.hillBodies.length} smooth cone hills`);
    }
    
    /**
     * Create a visual representation of the terrain that matches the height map
     */
    createTerrainVisualization() {
        console.log('Creating terrain visualization');
        
        const { width, length } = this.trackDimensions;
        const resolution = this.heightMapResolution;
        
        // Create plane geometry with high segment count
        const geometry = new THREE.PlaneGeometry(
            width,
            length,
            resolution - 1,
            resolution - 1
        );
        
        // Apply height map to geometry
        if (this.heightMapData) {
            const vertices = geometry.getAttribute('position').array;
            
            for (let i = 0; i < resolution; i++) {
                for (let j = 0; j < resolution; j++) {
                    const index = (i * resolution + j) * 3 + 2; // Z component in THREE.PlaneGeometry
                    vertices[index] = this.heightMapData[i][j];
                }
            }
            
            // Update the geometry
            geometry.getAttribute('position').needsUpdate = true;
            geometry.computeVertexNormals();
        }
        
        // Create an orangish-brown material for dirt appearance
        const material = new THREE.MeshStandardMaterial({
            color: 0xb35c1e, // Orangish-brown color for dirt
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false
        });
        
        // Create and add the mesh
        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.rotation.x = -Math.PI / 2; // Rotate to horizontal
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.position.set(0, this.groundLevel, 0);
        this.scene.add(this.terrainMesh);
        
        console.log('Terrain visualization created with orangish-brown ground');
    }
    
    /**
     * Create ramps for the track
     */
    createRamps() {
        console.log('Creating ramps for Milton MX track');
        
        // Add ramps with different colors at strategic positions
        const rampPositions = [
            { x: 200, z: 200, color: 0xFF0000, axis: 'x' },  // Red ramp (North-East)
            { x: -200, z: 200, color: 0x00FF00, axis: 'z' }, // Green ramp (North-West)
            { x: -200, z: -200, color: 0x0000FF, axis: 'x' }, // Blue ramp (South-West)
            { x: 200, z: -200, color: 0xFFFF00, axis: 'z' }  // Yellow ramp (South-East)
        ];
        
        // Create each ramp
        for (const pos of rampPositions) {
            this.createRamp(
                pos.x, pos.z,
                40, // width
                15, // height
                60, // depth
                Math.PI/10, // angle
                pos.axis,
                pos.color
            );
        }
        
        console.log('Ramps created for Milton MX track');
    }
    
    /**
     * Create a ramp on the track
     */
    createRamp(x, z, width, height, depth, angle, axis, color) {
        // Create physics body for the ramp
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const halfDepth = depth / 2;
        
        // Create a box shape for the ramp
        const rampShape = new CANNON.Box(new CANNON.Vec3(halfWidth, halfHeight, halfDepth));
        const rampBody = new CANNON.Body({ mass: 0 });
        rampBody.addShape(rampShape);
        
        // Position the ramp
        rampBody.position.set(x, this.groundLevel + halfHeight, z);
        
        // Rotate the ramp according to the specified axis
        if (axis === 'x') {
            rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), angle);
        } else if (axis === 'z') {
            rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
        }
        
        // Add to physics world
        this.world.addBody(rampBody);
        this.ramps.push(rampBody);
        
        // Create visual representation
        const rampGeometry = new THREE.BoxGeometry(width, height, depth);
        const rampMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            roughness: 0.5,
            metalness: 0.2
        });
        
        const rampMesh = new THREE.Mesh(rampGeometry, rampMaterial);
        rampMesh.position.copy(rampBody.position);
        
        // Match the rotation of the physics body
        if (axis === 'x') {
            rampMesh.rotation.x = angle;
        } else if (axis === 'z') {
            rampMesh.rotation.z = angle;
        }
        
        // Add to scene
        rampMesh.castShadow = true;
        rampMesh.receiveShadow = true;
        this.scene.add(rampMesh);
        this.rampMeshes.push(rampMesh);
        
        // Add a spotlight to illuminate the ramp
        const spotLight = new THREE.SpotLight(color, 1);
        spotLight.position.set(x, this.groundLevel + 40, z);
        spotLight.target = rampMesh;
        spotLight.angle = Math.PI / 6;
        spotLight.penumbra = 0.2;
        spotLight.decay = 1;
        spotLight.distance = 100;
        spotLight.castShadow = true;
        this.scene.add(spotLight);
        this.lights.push(spotLight);
        
        // Get color name for log
        const colorName = this.getColorName(color);
        console.log(`Created ${colorName} ramp at position (${x}, ${z})`);
        
        return { body: rampBody, mesh: rampMesh };
    }
    
    /**
     * Create walls around the track
     */
    createWalls() {
        console.log('Creating walls for Milton MX track');
        
        const { width, length } = this.trackDimensions;
        const halfWidth = width / 2;
        const halfLength = length / 2;
        const wallHeight = 20;
        const wallThickness = 10;
        
        // Define wall positions, sizes, and colors
        const wallPositions = [
            { position: { x: 0, y: this.groundLevel + wallHeight/2, z: halfLength }, size: { x: halfWidth * 2, y: wallHeight, z: wallThickness }, color: 0xaa3333 },
            { position: { x: 0, y: this.groundLevel + wallHeight/2, z: -halfLength }, size: { x: halfWidth * 2, y: wallHeight, z: wallThickness }, color: 0x3333aa },
            { position: { x: halfWidth, y: this.groundLevel + wallHeight/2, z: 0 }, size: { x: wallThickness, y: wallHeight, z: halfLength * 2 }, color: 0x33aa33 },
            { position: { x: -halfWidth, y: this.groundLevel + wallHeight/2, z: 0 }, size: { x: wallThickness, y: wallHeight, z: halfLength * 2 }, color: 0xaaaa33 }
        ];
        
        // Create each wall
        for (const wall of wallPositions) {
            // Create physics body for the wall
            const wallShape = new CANNON.Box(new CANNON.Vec3(
                wall.size.x / 2,
                wall.size.y / 2,
                wall.size.z / 2
            ));
            
            const wallBody = new CANNON.Body({ mass: 0 });
            wallBody.addShape(wallShape);
            wallBody.position.copy(wall.position);
            this.world.addBody(wallBody);
            this.walls.push(wallBody);
            
            // Create visual representation
            const wallGeometry = new THREE.BoxGeometry(
                wall.size.x,
                wall.size.y,
                wall.size.z
            );
            
            const wallMaterial = new THREE.MeshStandardMaterial({
                color: wall.color,
                transparent: true,
                opacity: 0.6,
                roughness: 0.3,
                metalness: 0.5
            });
            
            const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
            wallMesh.position.copy(wall.position);
            wallMesh.castShadow = true;
            this.scene.add(wallMesh);
            
            // Get color name for log
            const colorName = this.getColorName(wall.color);
            console.log(`Created ${colorName} wall at position (${wall.position.x}, ${wall.position.z})`);
        }
        
        console.log('Walls created for Milton MX track');
    }
    
    /**
     * Create 3D text numbers to display on top of each hill
     */
    createHillNumbers() {
        console.log('Creating hill number markers');
        
        // Store references to number markers for cleanup
        this.hillNumbers = [];
        
        const { width, length } = this.trackDimensions;
        
        // Colors for different hill numbers (bright, distinct colors)
        const colors = [
            0xff0000, // Red - Hill 1
            0x00ff00, // Green - Hill 2
            0x0000ff, // Blue - Hill 3
            0xffff00, // Yellow - Hill 4
            0xff00ff  // Magenta - Hill 5
        ];
        
        // Create a marker for each hill
        this.hills.forEach((hill, index) => {
            // Convert normalized coordinates to world coordinates
            const worldX = hill.x * (width / 2);
            const worldZ = hill.z * (length / 2);
            
            // Position above the hill
            const worldY = this.groundLevel + hill.height + 20;
            
            // Create a colored sphere to mark the hill
            const markerGeometry = new THREE.SphereGeometry(15, 16, 16);
            const markerMaterial = new THREE.MeshStandardMaterial({
                color: colors[index % colors.length],
                emissive: colors[index % colors.length],
                emissiveIntensity: 0.6,
                metalness: 0.7,
                roughness: 0.2
            });
            
            // Create the marker mesh
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(worldX, worldY, worldZ);
            marker.castShadow = true;
            this.scene.add(marker);
            this.hillNumbers.push(marker);
            
            // Add a spotlight pointing down to highlight the hill
            const spotLight = new THREE.SpotLight(
                colors[index % colors.length],
                1.5,  // Intensity
                300,  // Distance
                Math.PI / 6, // Angle
                0.5,  // Penumbra
                1.0   // Decay
            );
            
            spotLight.position.set(worldX, worldY + 100, worldZ);
            spotLight.target.position.set(worldX, this.groundLevel, worldZ);
            this.scene.add(spotLight);
            this.scene.add(spotLight.target);
            this.hillNumbers.push(spotLight);
            this.hillNumbers.push(spotLight.target);
            
            console.log(`Created hill marker ${hill.number} at (${worldX}, ${worldY}, ${worldZ})`);
        });
        
        console.log('Hill markers created');
    }
    
    /**
     * Get the player start position
     * @returns {Object} Start position and rotation
     */
    getPlayerStartPosition() {
        return {
            position: { x: 0, y: this.groundLevel + 10, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
        };
    }
    
    /**
     * Get a friendly name for common colors
     * @param {number} color - The hex color value
     * @returns {string} A friendly name for the color
     */
    getColorName(color) {
        const colorMap = {
            0xFF0000: 'red',
            0x00FF00: 'green',
            0x0000FF: 'blue',
            0xFFFF00: 'yellow',
            0xaa3333: 'red',
            0x3333aa: 'blue',
            0x33aa33: 'green',
            0xaaaa33: 'yellow'
        };
        
        return colorMap[color] || `#${color.toString(16).padStart(6, '0')}`;
    }
    
    /**
     * Enable or disable debug visualizations
     * @param {boolean} enabled - Whether to enable debug visualizations
     */
    toggleDebug(enabled) {
        this.debugEnabled = enabled;
        
        // Toggle visibility of debug meshes
        for (const mesh of this.debugMeshes) {
            mesh.visible = enabled;
        }
        
        console.log(`Debug visualization ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Clean up resources when track is unloaded
     */
    cleanup() {
        console.log('Cleaning up Milton MX track resources');
        
        // Clean up hill physics bodies
        this.hillBodies.forEach(body => {
            if (body) this.world.removeBody(body);
        });
        this.hillBodies = [];
        
        // Clean up hill number markers
        if (this.hillNumbers) {
            this.hillNumbers.forEach(numberMesh => {
                if (numberMesh) {
                    if (numberMesh.geometry) numberMesh.geometry.dispose();
                    if (numberMesh.material) numberMesh.material.dispose();
                    this.scene.remove(numberMesh);
                }
            });
            this.hillNumbers = [];
        }
        
        // Remove walls
        for (const wall of this.walls) {
            this.world.removeBody(wall);
        }
        
        // Remove ramps
        for (const ramp of this.ramps) {
            this.world.removeBody(ramp);
        }
        
        // Call base class cleanup
        super.cleanup();
    }
}

export default MiltonMXTrack;
