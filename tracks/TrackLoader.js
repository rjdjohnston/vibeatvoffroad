/**
 * TrackLoader.js - Dynamic track loading system
 * Provides functionality to load and manage different tracks
 */

import DriftRaceTrack from './DriftRaceTrack.js';

/**
 * TrackLoader - Handles loading and instantiation of different track types
 * 
 * This class is responsible for loading the appropriate track based on track ID
 * and providing a uniform interface to interact with the loaded track.
 */
class TrackLoader {
    constructor(options) {
        this.scene = options.scene;
        this.world = options.world;
        this.materials = options.materials;
        
        // Store track registry - mapping track IDs to their classes
        this.trackRegistry = {
            'drift-race': DriftRaceTrack
            // Add more tracks here as they are implemented
            // 'desert': DesertTrack,
            // 'snow': SnowTrack, etc.
        };
        
        this.currentTrack = null;
        this.isLoading = false;
        this.loadingPromise = null;
    }
    
    /**
     * Load a track by its ID
     * @param {String} trackId - The ID of the track to load
     * @returns {Promise} - A promise that resolves when the track is loaded
     */
    async loadTrack(trackId) {
        console.log(`TrackLoader: Loading track with ID: ${trackId}`);
        
        // Prevent loading multiple tracks simultaneously
        if (this.isLoading) {
            console.warn('TrackLoader: Already loading a track, please wait');
            return this.loadingPromise;
        }
        
        // Clean up previous track if it exists
        if (this.currentTrack) {
            console.log('TrackLoader: Cleaning up previous track');
            this.currentTrack.cleanup();
            this.currentTrack = null;
        }
        
        // Check if the requested track exists in our registry
        const TrackClass = this.trackRegistry[trackId];
        if (!TrackClass) {
            console.error(`TrackLoader: Track with ID "${trackId}" not found in registry`);
            return Promise.reject(new Error(`Track "${trackId}" not found`));
        }
        
        // Set loading state
        this.isLoading = true;
        
        try {
            // Create a new instance of the track
            console.log(`TrackLoader: Creating new instance of ${trackId} track`);
            const trackOptions = {
                scene: this.scene,
                world: this.world,
                materials: this.materials
            };
            
            this.currentTrack = new TrackClass(trackOptions);
            
            // Create a promise to handle the asynchronous loading
            this.loadingPromise = this.currentTrack.load();
            
            // Wait for the track to load
            await this.loadingPromise;
            
            console.log(`TrackLoader: Track "${trackId}" loaded successfully`);
            return this.currentTrack;
        } catch (error) {
            console.error(`TrackLoader: Failed to load track "${trackId}":`, error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Get the currently loaded track
     * @returns {BaseTrack|null} - The current track, or null if no track is loaded
     */
    getCurrentTrack() {
        return this.currentTrack;
    }
    
    /**
     * Check if a track is currently loading
     * @returns {Boolean} - True if a track is currently loading, false otherwise
     */
    isTrackLoading() {
        return this.isLoading;
    }
    
    /**
     * Set debug visualization for the current track
     * @param {Boolean} visible - Whether debug visualizations should be visible
     */
    setDebugVisible(visible) {
        if (this.currentTrack) {
            this.currentTrack.setDebugVisible(visible);
        }
    }
}

export default TrackLoader;
