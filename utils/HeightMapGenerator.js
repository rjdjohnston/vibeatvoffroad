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
     * Create a CANNON.js heightfield from a height map
     * @param {Object} heightMap - The height map data
     * @param {CANNON.World} world - The physics world to add the heightfield to
     * @returns {CANNON.Body} The created heightfield body
     */
    static createHeightfieldBody(heightMap, world) {
        if (!heightMap) {
            console.error('No height map provided for heightfield creation');
            return null;
        }
        
        const { data, width, height, minHeight, maxHeight, physicalWidth, physicalLength } = heightMap;
        
        console.log(`Creating heightfield from ${width}x${height} height map`);
        console.log(`Height range: ${minHeight} to ${maxHeight}`);
        
        // Create a 2D array for the heightfield data
        const heightfieldData = [];
        for (let i = 0; i < height; i++) {
            const row = [];
            for (let j = 0; j < width; j++) {
                // Get the height value from the red channel
                const pixelIndex = (i * width + j) * 4;
                const heightValue = data[pixelIndex] * (maxHeight - minHeight) + minHeight;
                
                // Scale the height to make it more pronounced
                const scaledHeight = heightValue * 2.0; // Amplify the height differences
                
                row.push(scaledHeight);
            }
            heightfieldData.push(row);
        }
        
        // Create the heightfield shape
        const elementSize = physicalWidth / (width - 1);
        console.log(`Heightfield element size: ${elementSize}`);
        
        const heightfieldShape = new CANNON.Heightfield(heightfieldData, {
            elementSize: elementSize
        });
        
        // Create the body
        const heightfieldBody = new CANNON.Body({ mass: 0 });
        heightfieldBody.addShape(heightfieldShape);
        
        // Position the heightfield
        heightfieldBody.position.set(
            -physicalWidth / 2,
            minHeight,
            -physicalLength / 2
        );
        
        // Rotate the heightfield to match the CANNON.js coordinate system
        heightfieldBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        
        // Add to the world
        if (world) {
            world.addBody(heightfieldBody);
            console.log('Added heightfield body to physics world');
        }
        
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
        
        // Create a material with height-based coloring
        const material = new THREE.MeshStandardMaterial({
            wireframe: true,
            side: THREE.DoubleSide,
            vertexColors: true,
            transparent: true,
            opacity: 0.2 // Make it very subtle
        });
        
        // Add vertex colors based on height
        const colors = new Float32Array(vertices.length);
        const color = new THREE.Color();
        
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const index = (i * width + j);
                const vertexIndex = index * 3;
                const colorIndex = index * 3;
                
                // Get normalized height (0 to 1)
                const normalizedHeight = (vertices[vertexIndex + 1] - minHeight) / ((maxHeight - minHeight) * 2.0 || 1);
                
                // Create color gradient based on height
                if (normalizedHeight < 0.2) {
                    // Blue for low areas
                    color.setRGB(0, 0, 1);
                } else if (normalizedHeight < 0.4) {
                    // Cyan for lower-mid areas
                    color.setRGB(0, normalizedHeight * 2, 1);
                } else if (normalizedHeight < 0.6) {
                    // Green for mid areas
                    color.setRGB(0, 1, normalizedHeight < 0.5 ? 1 : 2 - normalizedHeight * 2);
                } else if (normalizedHeight < 0.8) {
                    // Yellow for upper-mid areas
                    color.setRGB(normalizedHeight * 1.25, 1, 0);
                } else {
                    // Red for high areas
                    color.setRGB(1, 2 - normalizedHeight * 2, 0);
                }
                
                colors[colorIndex] = color.r;
                colors[colorIndex + 1] = color.g;
                colors[colorIndex + 2] = color.b;
            }
        }
        
        // Add colors to geometry
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create the mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        // Rotate to match the CANNON.js heightfield
        mesh.rotation.x = -Math.PI / 2;
        
        // Position the mesh
        mesh.position.set(0, 0, 0);
        
        // Add to the scene
        scene.add(mesh);
        
        // Only add grid helpers if debug is explicitly enabled
        // We'll check for a debug flag in the scene's userData
        const debugEnabled = scene.userData && scene.userData.debugEnabled;
        
        if (debugEnabled) {
            // Add a grid helper to better visualize the terrain
            const gridHelper = new THREE.GridHelper(
                Math.max(physicalWidth, physicalLength), 
                20, 
                0x888888, 
                0x444444
            );
            gridHelper.position.y = 0.1; // Position slightly above the terrain
            scene.add(gridHelper);
            
            // Add a wireframe box to show the height range
            const boxGeometry = new THREE.BoxGeometry(
                physicalWidth, 
                (maxHeight - minHeight) * 2.0, 
                physicalLength
            );
            const boxMaterial = new THREE.MeshBasicMaterial({
                wireframe: true,
                color: 0xff0000
            });
            const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
            boxMesh.position.set(
                0,
                minHeight + (maxHeight - minHeight), // Center vertically in the height range
                0
            );
            scene.add(boxMesh);
        }
        
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
}

export default HeightMapGenerator;
