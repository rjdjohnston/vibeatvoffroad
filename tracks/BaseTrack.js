/**
 * BaseTrack - Abstract base class for all tracks
 * 
 * This serves as a template that all specific track implementations should extend.
 * It provides common functionality and a consistent interface for working with different tracks.
 */
class BaseTrack {
    /**
     * Constructor for the BaseTrack
     * @param {Object} options - Configuration options for the track
     * @param {THREE.Scene} options.scene - The THREE.js scene
     * @param {CANNON.World} options.world - The CANNON.js physics world
     * @param {Object} options.materials - Physics materials
     */
    constructor(options) {
        if (!options.scene) throw new Error('Scene is required');
        if (!options.world) throw new Error('Physics world is required');
        
        this.scene = options.scene;
        this.world = options.world;
        this.materials = options.materials || {};
        
        // Common properties all tracks should have
        this.name = 'Base Track';
        this.trackMesh = null;
        this.trackCollider = null;
        
        // Array to hold track objects
        this.walls = [];
        this.ramps = [];
        this.rampMeshes = [];
        this.lights = [];
        this.debugMeshes = [];
        this.checkpoints = [];
    }
    
    /**
     * Load the track - must be implemented by child classes
     * @returns {Promise} - A promise that resolves when the track is loaded
     */
    async load() {
        throw new Error('load() method must be implemented by derived classes');
    }
    
    /**
     * Create physics for the track - must be implemented by child classes
     */
    createPhysics() {
        throw new Error('createPhysics() method must be implemented by derived classes');
    }
    
    /**
     * Create ramps for the track - must be implemented by child classes
     */
    createRamps() {
        throw new Error('createRamps() method must be implemented by derived classes');
    }
    
    /**
     * Get the player start position for this track
     * @returns {Object} - The player start position and rotation
     */
    getPlayerStartPosition() {
        return {
            position: { x: 0, y: 5, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 }
        };
    }
    
    /**
     * Get the checkpoints for this track
     * @returns {Array} - Array of checkpoint positions
     */
    getCheckpoints() {
        return this.checkpoints;
    }
    
    /**
     * Set debug visualization state
     * @param {boolean} visible - Whether debug visualizations should be visible
     */
    setDebugVisible(visible) {
        throw new Error('setDebugVisible() method must be implemented by derived classes');
    }
    
    /**
     * Clean up track resources
     * This is important to prevent memory leaks when switching tracks
     */
    cleanup() {
        // Remove all track objects from scene and world
        if (this.trackMesh) {
            this.scene.remove(this.trackMesh);
        }
        
        if (this.trackCollider) {
            this.world.remove(this.trackCollider);
        }
        
        // Remove all walls
        this.walls.forEach(wall => {
            this.world.remove(wall);
        });
        
        // Remove all ramps (physics)
        this.ramps.forEach(ramp => {
            this.world.remove(ramp);
        });
        
        // Remove all ramp meshes (visual)
        this.rampMeshes.forEach(mesh => {
            this.scene.remove(mesh);
        });
        
        // Remove all lights
        this.lights.forEach(light => {
            this.scene.remove(light);
        });
        
        // Remove all debug meshes
        this.debugMeshes.forEach(mesh => {
            this.scene.remove(mesh);
        });
        
        // Clear arrays
        this.walls = [];
        this.ramps = [];
        this.rampMeshes = [];
        this.lights = [];
        this.debugMeshes = [];
        this.checkpoints = [];
        
        // Clear references
        this.trackMesh = null;
        this.trackCollider = null;
    }
}

export default BaseTrack;
