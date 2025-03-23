// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0000ff); // Blue background (fallback)
document.body.appendChild(renderer.domElement);

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
console.log('Starting skybox load...');
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
        console.log('Desert skybox loaded at:', skybox.position, 'Scale:', skybox.scale);
        console.log('Scene children after adding skybox:', scene.children.length);
    },
    (progress) => console.log('Loading skybox progress:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('Skybox loading failed:', error)
);

// Load 3D Race Track Model
console.log('Loading 3D race track model...');
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
        
        console.log('3D track model loaded successfully:', trackMesh);
        
        // Add physics for the track using a simplified approach
        createTrackPhysics(trackMesh);
        
        // Adjust ATV starting position to match the new track
        if (chassisBody) {
            chassisBody.position.set(0, 10, 0); // Increased height for safety
            chassisBody.velocity.set(0, 0, 0);
            chassisBody.angularVelocity.set(0, 0, 0);
            chassisBody.quaternion.set(0, 0, 0, 1);
        }
    },
    (progress) => console.log('Loading 3D track progress:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('3D track loading failed:', error)
);

// Function to create physics for the track
function createTrackPhysics(trackModel) {
    console.log("Creating physics for track model");
    
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
    
    console.log("Track bounding box:", 
        "X:", minX, "to", maxX,
        "Y:", minY, "to", maxY,
        "Z:", minZ, "to", maxZ
    );
    
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
    
    console.log("Added main track collider with dimensions:", 
        "Width:", trackWidth * 6, 
        "Length:", trackLength * 6,
        "Position:", trackPhysicsBody.position
    );
    
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
    
    console.log("Added wall colliders at edges:", 
        "North:", wallZ, 
        "South:", negWallZ, 
        "East:", wallX, 
        "West:", negWallX
    );
    
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
    scene.add(northWallDebug);
    
    // South wall debug
    const southWallGeo = new THREE.BoxGeometry(trackWidth * 2, wallHeight * 2, wallThickness * 2);
    const southWallDebug = new THREE.Mesh(southWallGeo, wallMaterial);
    southWallDebug.position.copy(southWallBody.position);
    scene.add(southWallDebug);
    
    // East wall debug
    const eastWallGeo = new THREE.BoxGeometry(wallThickness * 2, wallHeight * 2, trackLength * 2);
    const eastWallDebug = new THREE.Mesh(eastWallGeo, wallMaterial);
    eastWallDebug.position.copy(eastWallBody.position);
    scene.add(eastWallDebug);
    
    // West wall debug
    const westWallGeo = new THREE.BoxGeometry(wallThickness * 2, wallHeight * 2, trackLength * 2);
    const westWallDebug = new THREE.Mesh(westWallGeo, wallMaterial);
    westWallDebug.position.copy(westWallBody.position);
    scene.add(westWallDebug);
    
    console.log("Track physics created");
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
chassisBody.position.set(0, 5, 0);
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
        atvMesh.scale.set(0.1, 0.1, 0.1);
        scene.add(atvMesh);
        atvMesh.position.copy(chassisBody.position);
        atvMesh.position.y += 1.7;
        atvMesh.quaternion.copy(chassisBody.quaternion);
        console.log('ATV loaded successfully');
    },
    (progress) => console.log('Loading ATV:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('ATV loading failed:', error)
);

// Load and place survival assets
gltfLoader.load(
    'assets/survival/scene.gltf',
    (gltf) => {
        console.log('Survival GLTF loaded:', gltf);
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
                console.log(`Material for ${node.name}:`, node.material);
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
                console.log('Tire placed at:', tireClone.position);
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
                console.log('Barrel placed at:', barrelClone.position);
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
                console.log('Extra barrel placed near track at:', barrelClone.position);
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
            console.log(`${asset.mesh.name} placed on track at:`, clone.position);
        });

        console.log('Survival assets loaded and placed');
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

// Animation loop
let settled = false;
function animate() {
    requestAnimationFrame(animate);

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
        speedometer.textContent = `Speed: ${speedDisplay} km/h`;

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
    }

    if (chassisBody.position.y < -25 || chassisBody.position.y > 50) {
        // If the ATV falls through or flies off, reset it
        chassisBody.position.set(0, 10, 0);
        chassisBody.velocity.set(0, 0, 0);
        chassisBody.angularVelocity.set(0, 0, 0);
        chassisBody.quaternion.set(0, 0, 0, 1);
        settled = false;
        chassisBody.linearDamping = 0.9;
        chassisBody.angularDamping = 0.9;
        console.log('ATV reset to starting position');
    }

    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});