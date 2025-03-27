/**
 * HeightMapGenerator.js
 * Utility for converting 3D meshes to height maps for physics
 */

class HeightMapGenerator {
    /**
     * Generate a height map from a 3D mesh
     * @param {THREE.Mesh} mesh - The mesh to convert
     * @param {Object} options - Configuration options
     * @param {Number} options.resolution - Resolution of the height map (pixels per side)
     * @param {Number} options.width - Width of the area to cover
     * @param {Number} options.length - Length of the area to cover
     * @returns {Object} The height map data and related information
     */
    static generateFromMesh(mesh, options = {}) {
        const resolution = options.resolution || 256;
        const width = options.width || 200;
        const length = options.length || 200;
        
        if (!mesh) {
            console.error('No mesh provided for height map generation');
            return null;
        }
        
        console.log(`Generating height map from mesh: ${mesh.name || 'unnamed'} at resolution ${resolution}x${resolution}`);
        
        // Find the terrain mesh if a scene was provided
        let terrainMesh = null;
        if (mesh.isScene || mesh.type === 'Group') {
            // If a scene or group was provided, find the terrain mesh
            mesh.traverse((child) => {
                if (child.isMesh && child.name.includes('material0_0')) {
                    terrainMesh = child;
                    console.log(`Found terrain mesh in scene: ${child.name}`);
                }
            });
            
            // If we found a terrain mesh, use it
            if (terrainMesh) {
                mesh = terrainMesh;
                console.log(`Using terrain mesh for height map: ${mesh.name}`);
            } else {
                console.warn('No specific terrain mesh found in scene, using entire scene');
            }
        }
        
        // Create a height map renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(resolution, resolution);
        
        // Create a temporary scene and camera for rendering the height map
        const tempScene = new THREE.Scene();
        
        // Use an orthographic camera looking down from above
        const tempCamera = new THREE.OrthographicCamera(
            -width / 2,
            width / 2,
            length / 2,
            -length / 2,
            0.1,
            1000
        );
        
        // Position the camera above the mesh looking down
        tempCamera.position.set(0, 100, 0);
        tempCamera.lookAt(0, 0, 0);
        
        // Add the mesh to the temporary scene
        let meshClone;
        if (mesh.isScene) {
            // If it's a scene, clone all children
            meshClone = new THREE.Group();
            mesh.children.forEach(child => {
                meshClone.add(child.clone());
            });
        } else {
            // Otherwise just clone the mesh
            meshClone = mesh.clone();
        }
        
        // Make sure the mesh is visible
        meshClone.visible = true;
        tempScene.add(meshClone);
        
        // Add a directional light to ensure the mesh is visible
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 100, 0);
        light.lookAt(0, 0, 0);
        tempScene.add(light);
        
        // Create a render target
        const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType
        });
        
        // Render the height map
        renderer.setRenderTarget(renderTarget);
        renderer.render(tempScene, tempCamera);
        
        // Read the pixel data
        const buffer = new Float32Array(resolution * resolution * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, resolution, resolution, buffer);
        
        // Find min and max heights
        let minHeight = Infinity;
        let maxHeight = -Infinity;
        
        // Create a separate array for just the height values
        const heightData = new Float32Array(resolution * resolution);
        
        for (let i = 0; i < resolution * resolution; i++) {
            // Height is stored in the red channel
            const height = buffer[i * 4];
            heightData[i] = height;
            minHeight = Math.min(minHeight, height);
            maxHeight = Math.max(maxHeight, height);
        }
        
        // If the height range is too small, apply contrast enhancement
        if (maxHeight - minHeight < 0.1) {
            console.warn('Height range is very small, applying contrast enhancement');
            
            // Apply contrast enhancement to make the terrain more pronounced
            const enhancedHeightData = this.enhanceContrast(heightData, resolution);
            
            // Update the buffer with enhanced height values
            for (let i = 0; i < resolution * resolution; i++) {
                buffer[i * 4] = enhancedHeightData[i];
                minHeight = Math.min(minHeight, enhancedHeightData[i]);
                maxHeight = Math.max(maxHeight, enhancedHeightData[i]);
            }
        }
        
        // Create the height map data
        const heightMap = {
            data: buffer,
            width: resolution,
            height: resolution,
            minHeight: minHeight,
            maxHeight: maxHeight,
            physicalWidth: width,
            physicalLength: length
        };
        
        // Clean up
        renderer.dispose();
        renderTarget.dispose();
        tempScene.remove(meshClone);
        
        console.log(`Height map generated with height range: ${minHeight} to ${maxHeight}`);
        
        return heightMap;
    }
    
    /**
     * Enhance contrast in the height map to make terrain features more pronounced
     * @param {Float32Array} heightData - The original height data
     * @param {Number} resolution - The resolution of the height map
     * @returns {Float32Array} The enhanced height data
     */
    static enhanceContrast(heightData, resolution) {
        const enhancedData = new Float32Array(resolution * resolution);
        
        // Find min and max heights
        let minHeight = Infinity;
        let maxHeight = -Infinity;
        
        for (let i = 0; i < heightData.length; i++) {
            minHeight = Math.min(minHeight, heightData[i]);
            maxHeight = Math.max(maxHeight, heightData[i]);
        }
        
        // If the range is too small, create artificial terrain
        if (maxHeight - minHeight < 0.01) {
            console.warn('Height range is extremely small, creating artificial terrain');
            
            // Create a perlin noise-like terrain
            for (let y = 0; y < resolution; y++) {
                for (let x = 0; x < resolution; x++) {
                    const index = y * resolution + x;
                    
                    // Create a simple hill pattern
                    const centerX = resolution / 2;
                    const centerY = resolution / 2;
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
                    
                    // Create a hill in the center
                    const baseHeight = heightData[index];
                    const hillHeight = Math.cos(distance / maxDistance * Math.PI) * 0.5 + 0.5;
                    
                    // Add some smaller hills
                    const smallHill1 = Math.cos(x / 10) * Math.cos(y / 10) * 0.1;
                    const smallHill2 = Math.sin(x / 15) * Math.sin(y / 15) * 0.1;
                    
                    enhancedData[index] = baseHeight + hillHeight * 0.3 + smallHill1 + smallHill2;
                }
            }
        } else {
            // Apply contrast enhancement
            const range = maxHeight - minHeight;
            const midpoint = (maxHeight + minHeight) / 2;
            const contrast = 5.0; // Higher values increase contrast
            
            for (let i = 0; i < heightData.length; i++) {
                // Normalize the height to [-1, 1] range
                const normalizedHeight = (heightData[i] - midpoint) / (range / 2);
                
                // Apply sigmoid function for smooth contrast enhancement
                const enhancedHeight = this.sigmoid(normalizedHeight * contrast);
                
                // Convert back to original range
                enhancedData[i] = enhancedHeight * (range / 2) + midpoint;
            }
        }
        
        return enhancedData;
    }
    
    /**
     * Sigmoid function for smooth contrast enhancement
     * @param {Number} x - Input value
     * @returns {Number} Sigmoid of the input
     */
    static sigmoid(x) {
        return 1 / (1 + Math.exp(-x)) * 2 - 1;
    }
    
    /**
     * Create a CANNON.js heightfield body from height map data
     * @param {Object} heightMap - Height map data
     * @param {CANNON.World} world - Physics world to add the body to
     * @returns {CANNON.Body} The created body
     */
    static createHeightfieldBody(heightMap, world) {
        if (!heightMap || !world) return null;
        
        // Extract data from the height map
        const { width, height, data, minHeight, maxHeight, physicalWidth, physicalLength } = heightMap;
        
        // Create a heightfield matrix for CANNON.js
        const matrix = [];
        for (let i = 0; i < height; i++) {
            matrix[i] = [];
            for (let j = 0; j < width; j++) {
                const index = (i * width + j) * 4;
                // Use the red channel for height data
                const heightValue = data[index] * (maxHeight - minHeight) + minHeight;
                matrix[i][j] = heightValue;
            }
        }
        
        // Fix the matrix orientation to ensure correct face normals
        // CANNON.js expects heightfields to have CCW winding order
        const fixedMatrix = [];
        for (let i = 0; i < height; i++) {
            fixedMatrix[i] = [];
            for (let j = 0; j < width; j++) {
                // Invert the matrix along one axis to fix the winding order
                fixedMatrix[i][j] = matrix[height - 1 - i][j];
            }
        }
        
        // Create the heightfield shape
        // Note: CANNON.js heightfields have their own coordinate system
        // where Y is up, which differs from THREE.js
        const heightfieldShape = new CANNON.Heightfield(fixedMatrix, {
            elementSize: physicalWidth / (width - 1)
        });
        
        // Create a body with the heightfield shape
        const heightfieldBody = new CANNON.Body({ mass: 0 });
        
        // Rotate the heightfield to match the THREE.js coordinate system
        // By default, CANNON.js heightfields are in the x-z plane with y up
        // We need to rotate it to match our coordinate system where y is up
        heightfieldBody.addShape(heightfieldShape);
        
        // Calculate the proper position offsets based on the heightfield size
        // This ensures the heightfield is properly centered
        const sizeX = physicalWidth;
        const sizeZ = physicalLength;
        
        // Position the heightfield centered at the origin
        heightfieldBody.position.set(-sizeX / 2, 0, -sizeZ / 2);
        
        // Add the body to the world
        world.addBody(heightfieldBody);
        
        console.log(`Created heightfield body with dimensions ${width}x${height}`);
        
        return heightfieldBody;
    }
    
    /**
     * Create a visualization of the height map for debugging
     * @param {Object} heightMap - The height map data
     * @param {THREE.Scene} scene - The scene to add the visualization to
     * @returns {THREE.Mesh} The created visualization mesh
     */
    static createHeightMapVisualization(heightMap, scene) {
        if (!heightMap || !scene) return null;
        
        const { width, height, data, minHeight, maxHeight, physicalWidth, physicalLength } = heightMap;
        
        // Create a plane geometry
        const geometry = new THREE.PlaneGeometry(
            physicalWidth,
            physicalLength,
            width - 1,
            height - 1
        );
        
        // Update the vertices based on the height map
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const index = (i * width + j);
                const vertexIndex = index * 3;
                
                // Get height from the red channel
                const pixelIndex = index * 4;
                const heightValue = data[pixelIndex] * (maxHeight - minHeight) + minHeight;
                
                // Scale the height to match the physics heightfield
                const scaledHeight = heightValue * 2.0;
                
                // Update the y coordinate (height)
                vertices[vertexIndex + 1] = scaledHeight;
            }
        }
        
        // Update the geometry
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        // Create a HOT PINK material with height-based coloring
        const material = new THREE.MeshStandardMaterial({
            color: 0xFF1493, // Hot Pink color
            emissive: 0xFF1493, // Hot Pink emissive color for extra visibility
            emissiveIntensity: 0.7, // Higher intensity for better visibility
            wireframe: true,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8, // More opaque for better visibility
            wireframeLinewidth: 3 // Thicker wireframe (note: not supported in all browsers)
        });
        
        // Create the mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        // Rotate to match the CANNON.js heightfield
        mesh.rotation.x = -Math.PI / 2;
        
        // Add to the scene
        scene.add(mesh);
        
        console.log(`Created HOT PINK height map visualization with ${width}x${height} resolution`);
        
        return mesh;
    }
    
    /**
     * Save the height map as a texture
     * @param {Object} heightMap - The height map data
     * @returns {THREE.DataTexture} The created texture
     */
    static createHeightMapTexture(heightMap) {
        if (!heightMap) return null;
        
        const { width, height, data, minHeight, maxHeight } = heightMap;
        
        // Create a new data array for the texture (RGB format)
        const textureData = new Uint8Array(width * height * 3);
        
        // Convert the height data to RGB values
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const index = (i * width + j);
                const pixelIndex = index * 4;
                const textureIndex = index * 3;
                
                // Normalize height value to 0-1 range
                const normalizedHeight = (data[pixelIndex] - minHeight) / (maxHeight - minHeight);
                
                // Convert to 0-255 range for RGB
                const heightValue = Math.floor(normalizedHeight * 255);
                
                // Set RGB values (grayscale)
                textureData[textureIndex] = heightValue;     // R
                textureData[textureIndex + 1] = heightValue; // G
                textureData[textureIndex + 2] = heightValue; // B
            }
        }
        
        // Create the texture
        const texture = new THREE.DataTexture(
            textureData,
            width,
            height,
            THREE.RGBFormat
        );
        
        texture.needsUpdate = true;
        
        return texture;
    }
    
    /**
     * Generate artificial terrain data for visualization and physics
     * @param {Object} options - Configuration options
     * @param {Number} options.resolution - Resolution of the height map
     * @param {Number} options.width - Width of the terrain
     * @param {Number} options.length - Length of the terrain
     * @returns {Object} The artificial height map data
     */
    static generateArtificialTerrain(options = {}) {
        const resolution = options.resolution || 256;
        const width = options.width || 200;
        const length = options.length || 200;
        
        console.log(`Generating artificial terrain at resolution ${resolution}x${resolution} with size ${width}x${length}`);
        
        // Create a data array
        const data = new Float32Array(resolution * resolution * 4);
        
        // Create artificial terrain using multiple noise functions
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const pixelIndex = (i * resolution + j) * 4;
                
                // Normalize coordinates to -1 to 1 range
                const x = (j / resolution) * 2 - 1;
                const z = (i / resolution) * 2 - 1;
                
                // Calculate distance from center
                const distanceFromCenter = Math.sqrt(x * x + z * z);
                
                // Create a base bowl-shaped terrain that rises at the edges
                let height = distanceFromCenter * 3;
                
                // Add some hills using sine waves
                height += Math.sin(x * 5) * Math.cos(z * 5) * 2;
                
                // Add a central mound
                height -= Math.exp(-(x*x + z*z) * 2) * 5;
                
                // Add some smaller bumps
                height += Math.sin(x * 20) * Math.cos(z * 20) * 0.5;
                
                // Add a ramp feature in one quadrant
                if (x > 0 && z > 0) {
                    height += (x + z) * 3;
                }
                
                // Add a canyon/trench feature
                if (Math.abs(x - 0.3) < 0.1) {
                    height -= 2;
                }
                
                // Add a plateau
                if (x < -0.3 && z < -0.3) {
                    height = Math.max(height, 2);
                }
                
                // Store the height in all channels (for compatibility with other functions)
                data[pixelIndex] = height;
                data[pixelIndex + 1] = height;
                data[pixelIndex + 2] = height;
                data[pixelIndex + 3] = 1;
            }
        }
        
        // Find min and max heights
        let minHeight = Infinity;
        let maxHeight = -Infinity;
        
        for (let i = 0; i < resolution * resolution; i++) {
            const pixelIndex = i * 4;
            minHeight = Math.min(minHeight, data[pixelIndex]);
            maxHeight = Math.max(maxHeight, data[pixelIndex]);
        }
        
        // Normalize heights to a reasonable range
        const desiredMinHeight = -5;
        const desiredMaxHeight = 5;
        const scale = (desiredMaxHeight - desiredMinHeight) / (maxHeight - minHeight);
        
        for (let i = 0; i < resolution * resolution; i++) {
            const pixelIndex = i * 4;
            data[pixelIndex] = (data[pixelIndex] - minHeight) * scale + desiredMinHeight;
            data[pixelIndex + 1] = data[pixelIndex];
            data[pixelIndex + 2] = data[pixelIndex];
        }
        
        // Update min/max heights
        minHeight = desiredMinHeight;
        maxHeight = desiredMaxHeight;
        
        console.log(`Artificial terrain generated with height range: ${minHeight} to ${maxHeight}`);
        
        // Create the height map data
        const heightMap = {
            data: data,
            width: resolution,
            height: resolution,
            minHeight: minHeight,
            maxHeight: maxHeight,
            physicalWidth: width,
            physicalLength: length
        };
        
        return heightMap;
    }
}

export default HeightMapGenerator;
