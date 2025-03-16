// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

// Loaders
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new THREE.GLTFLoader();

// Terrain (flat with dirt texture)
const terrainSize = 100;
const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize);
const dirtTexture = textureLoader.load(
    'textures/dirt.jpg',
    (texture) => console.log('Texture loaded successfully:', texture),
    undefined,
    (error) => console.error('Texture loading failed:', error)
);
dirtTexture.wrapS = dirtTexture.wrapT = THREE.RepeatWrapping;
dirtTexture.repeat.set(1, 1);
const terrainMaterial = new THREE.MeshPhongMaterial({ map: dirtTexture });
const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrainMesh.rotation.x = -Math.PI / 2;
scene.add(terrainMesh);

// Physics terrain (flat plane)
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0 });
groundBody.addShape(groundShape);
groundBody.position.set(0, 0, 0);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

// Load ATV model
let atvMesh;
gltfLoader.load(
    'models/atv/scene.gltf',
    (gltf) => {
        atvMesh = gltf.scene;
        atvMesh.scale.set(0.1, 0.1, 0.1);
        scene.add(atvMesh);
        atvMesh.position.copy(atvBody.position);
        atvMesh.position.y += 1.7; // Your favorite offset
        atvMesh.quaternion.copy(atvBody.quaternion);
        console.log('ATV loaded successfully');
    },
    (progress) => console.log('Loading ATV:', progress.loaded / progress.total * 100 + '%'),
    (error) => console.error('ATV loading failed:', error)
);

// ATV physics
const atvShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 1)); // Half-extents: 2x1x2
const atvBody = new CANNON.Body({ mass: 5 });
atvBody.addShape(atvShape, new CANNON.Vec3(0, -0.25, 0)); // Offset down 0.25
atvBody.position.set(0, 10, 0);
atvBody.quaternion.set(0, 0, 0, 1); // Front toward camera
atvBody.linearDamping = 0.1;
atvBody.angularDamping = 0.5;
atvBody.fixedRotation = true;
atvBody.updateMassProperties();
world.addBody(atvBody);

// Camera setup (initial position behind ATV)
camera.position.set(0, 10, -10); // Behind ATV’s back
camera.lookAt(0, 0, 0);

// Keyboard controls
const controls = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w': controls.forward = true; break;
        case 's': controls.backward = true; break;
        case 'a': controls.left = true; break;
        case 'd': controls.right = true; break;
    }
});
document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w': controls.forward = false; break;
        case 's': controls.backward = false; break;
        case 'a': controls.left = false; break;
        case 'd': controls.right = false; break;
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);

    // Controls
    const speed = 50; // Your favorite speed
    const turnSpeed = 2;
    const localDirection = new CANNON.Vec3(0, 0, -1); // Local forward (front of ATV)
    const worldDirection = atvBody.quaternion.vmult(localDirection);
    worldDirection.y = 0; // Keep it on the plane
    worldDirection.normalize();
    if (controls.forward) { // W moves away from camera (back visible)
        atvBody.velocity.x = -worldDirection.x * speed;
        atvBody.velocity.z = -worldDirection.z * speed;
    } else if (controls.backward) { // S moves toward camera (front visible)
        atvBody.velocity.x = worldDirection.x * speed;
        atvBody.velocity.z = worldDirection.z * speed;
    } else {
        atvBody.velocity.x = 0;
        atvBody.velocity.z = 0;
    }
    if (controls.left) atvBody.angularVelocity.y = turnSpeed;
    if (controls.right) atvBody.angularVelocity.y = -turnSpeed;
    if (!controls.left && !controls.right) atvBody.angularVelocity.y = 0;

    if (atvMesh) {
        atvMesh.position.copy(atvBody.position);
        atvMesh.position.y += 1.7; // Your favorite offset
        atvMesh.quaternion.copy(atvBody.quaternion);

        // Camera follow (behind ATV’s back)
        const cameraOffset = new THREE.Vector3(0, 5, -10); // Up 5, behind 10
        const atvPosition = new THREE.Vector3().copy(atvMesh.position);
        const atvQuaternion = new THREE.Quaternion().copy(atvMesh.quaternion);
        cameraOffset.applyQuaternion(atvQuaternion); // Rotate offset with ATV
        const targetCameraPosition = atvPosition.add(cameraOffset);

        // Smooth camera movement
        camera.position.lerp(targetCameraPosition, 0.1); // Smooth lerp
        camera.lookAt(atvMesh.position); // Look at ATV
    }

    // Reset if ATV falls too far
    if (atvBody.position.y < -10) {
        atvBody.position.set(0, 10, 0);
        atvBody.velocity.set(0, 0, 0);
        atvBody.angularVelocity.set(0, 0, 0);
        console.log('ATV reset to starting position');
    }

    // Debug positions
    console.log('ATV body position:', atvBody.position);
    if (atvMesh) console.log('ATV mesh position:', atvMesh.position);
    console.log('ATV velocity:', atvBody.velocity);
    console.log('ATV quaternion:', atvBody.quaternion);
    console.log('ATV angular velocity:', atvBody.angularVelocity);
    console.log('World direction:', worldDirection);
    console.log('Camera position:', camera.position);
    console.log('Rendering');

    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});