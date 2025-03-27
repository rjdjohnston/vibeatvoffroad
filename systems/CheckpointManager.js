// CheckpointManager.js
// This class encapsulates all checkpoint-related functionality for Vibe ATV Off-road.
// It was refactored out of script.js. Ensure you pass in the THREE.js scene and camera when instantiating.

class CheckpointManager {
    constructor(scene, camera, options = {}) {
        // References to external objects
        this.scene = scene;
        this.camera = camera;

        // Checkpoint state
        this.checkpoints = [];
        this.activeCheckpoint = 0;
        this.checkpointPositions = null; // Can be set when loading a configuration
        this.isEditMode = false;
        this.lastCheckpointTime = 0;
        this.currentLapTime = 0;
        this.bestLapTime = Infinity;
        this.trackConfigName = 'default';
        this.isAuthorizedEditor = false;  // Should be set externally based on player authorization

        // External callbacks (should be bound externally if needed)
        this.playSound = options.playSound || function(sound) { console.log('Playing sound:', sound); };
        this.showNotification = options.showNotification || function(message, isError) { console.log('Notification:', message); };
        this.updateCheckpointUI = options.updateCheckpointUI || function() {};
    }

    // Initialize checkpoint system, setting up authorization, loading config, and UI controls.
    initCheckpoints(playerName, loadConfigCallback) {
        console.log('Initializing checkpoints, player name:', playerName);
        // Set authorization flag
        this.isAuthorizedEditor = (playerName === 'RJ_4_America');
        console.log('isAuthorizedEditor:', this.isAuthorizedEditor);

        // Determine track configuration based on URL parameter if available
        const urlParams = new URLSearchParams(window.location.search);
        const configParam = urlParams.get('trackConfig');
        if (this.isAuthorizedEditor) {
            if (configParam) {
                this.trackConfigName = configParam;
                console.log('Authorized editor loading specified config:', this.trackConfigName);
                this.loadTrackConfig(this.trackConfigName);
            } else {
                console.log('Authorized editor loading default config');
                this.loadTrackConfig('default');
            }
        } else {
            console.log('Regular player loading default config');
            this.loadTrackConfig('default');
        }

        // Create checkpoints
        this.createCheckpoints();

        // If authorized, create checkpoint controls UI
        if (this.isAuthorizedEditor) {
            this.createCheckpointControls();
            this.showNotification('Welcome RJ_4_America - Track Editor Mode Available (Press E)', false);
        }
    }

    // Create checkpoint editor UI
    createCheckpointControls() {
        console.log('Creating checkpoint controls for authorized editor');
        if (document.getElementById('checkpoint-controls')) {
            document.getElementById('checkpoint-controls').style.display = 'block';
            console.log('Checkpoint controls already exist, showing them');
            return;
        }
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'checkpoint-controls';
        controlsDiv.style.position = 'absolute';
        controlsDiv.style.top = '260px';
        controlsDiv.style.right = '20px';
        controlsDiv.style.background = 'rgba(0, 0, 0, 0.7)';
        controlsDiv.style.padding = '15px';
        controlsDiv.style.borderRadius = '10px';
        controlsDiv.style.color = 'white';
        controlsDiv.style.zIndex = '1000';
        controlsDiv.style.fontFamily = 'Arial, sans-serif';

        // Editor badge
        const editorBadge = document.createElement('div');
        editorBadge.textContent = 'TRACK EDITOR - RJ_4_America';
        editorBadge.style.backgroundColor = '#e74c3c';
        editorBadge.style.color = 'white';
        editorBadge.style.padding = '5px 10px';
        editorBadge.style.borderRadius = '3px';
        editorBadge.style.fontWeight = 'bold';
        editorBadge.style.textAlign = 'center';
        editorBadge.style.marginBottom = '15px';
        editorBadge.style.fontSize = '14px';
        controlsDiv.appendChild(editorBadge);

        // Title
        const title = document.createElement('div');
        title.textContent = 'CHECKPOINT EDITOR';
        title.style.fontWeight = 'bold';
        title.style.textAlign = 'center';
        title.style.marginBottom = '15px';
        title.style.fontSize = '16px';
        title.style.borderBottom = '1px solid #555';
        title.style.paddingBottom = '5px';
        controlsDiv.appendChild(title);

        // Status message
        const statusMessage = document.createElement('div');
        statusMessage.textContent = 'Editor controls active! Press E to toggle edit mode.';
        statusMessage.style.backgroundColor = 'rgba(46, 204, 113, 0.3)';
        statusMessage.style.padding = '10px';
        statusMessage.style.borderRadius = '5px';
        statusMessage.style.marginBottom = '15px';
        statusMessage.style.textAlign = 'center';
        statusMessage.style.fontSize = '14px';
        controlsDiv.appendChild(statusMessage);

        // Edit mode toggle button
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit Checkpoints';
        editButton.style.display = 'block';
        editButton.style.width = '100%';
        editButton.style.marginBottom = '10px';
        editButton.style.padding = '8px 15px';
        editButton.style.borderRadius = '5px';
        editButton.style.backgroundColor = '#3498db';
        editButton.style.color = 'white';
        editButton.style.border = 'none';
        editButton.style.cursor = 'pointer';
        editButton.addEventListener('click', () => this.toggleEditMode());
        controlsDiv.appendChild(editButton);

        // Save positions button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Positions';
        saveButton.style.display = 'block';
        saveButton.style.width = '100%';
        saveButton.style.marginBottom = '10px';
        saveButton.style.padding = '8px 15px';
        saveButton.style.borderRadius = '5px';
        saveButton.style.backgroundColor = '#2ecc71';
        saveButton.style.color = 'white';
        saveButton.style.border = 'none';
        saveButton.style.cursor = 'pointer';
        saveButton.addEventListener('click', () => this.saveCheckpointPositions());
        controlsDiv.appendChild(saveButton);

        // Export positions button
        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export to JSON';
        exportButton.style.display = 'block';
        exportButton.style.width = '100%';
        exportButton.style.marginBottom = '10px';
        exportButton.style.padding = '8px 15px';
        exportButton.style.borderRadius = '5px';
        exportButton.style.backgroundColor = '#9b59b6';
        exportButton.style.color = 'white';
        exportButton.style.border = 'none';
        exportButton.style.cursor = 'pointer';
        exportButton.addEventListener('click', () => this.exportCheckpointPositions());
        controlsDiv.appendChild(exportButton);

        // Configuration name input
        const configNameLabel = document.createElement('div');
        configNameLabel.textContent = 'Configuration Name:';
        configNameLabel.style.marginTop = '10px';
        configNameLabel.style.marginBottom = '5px';
        configNameLabel.style.fontSize = '14px';
        controlsDiv.appendChild(configNameLabel);

        const configNameInput = document.createElement('input');
        configNameInput.type = 'text';
        configNameInput.id = 'config-name-input';
        configNameInput.value = this.trackConfigName;
        configNameInput.style.width = '100%';
        configNameInput.style.padding = '5px';
        configNameInput.style.marginBottom = '10px';
        configNameInput.style.borderRadius = '3px';
        configNameInput.style.border = '1px solid #aaa';
        configNameInput.style.backgroundColor = '#222';
        configNameInput.style.color = '#fff';
        configNameInput.addEventListener('change', () => {
            this.trackConfigName = configNameInput.value || 'default';
        });
        controlsDiv.appendChild(configNameInput);

        // Reset positions button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Positions';
        resetButton.style.display = 'block';
        resetButton.style.width = '100%';
        resetButton.style.marginBottom = '15px';
        resetButton.style.padding = '8px 15px';
        resetButton.style.borderRadius = '5px';
        resetButton.style.backgroundColor = '#e74c3c';
        resetButton.style.color = 'white';
        resetButton.style.border = 'none';
        resetButton.style.cursor = 'pointer';
        resetButton.addEventListener('click', () => this.resetCheckpointPositions());
        controlsDiv.appendChild(resetButton);

        // Info text
        const infoText = document.createElement('div');
        infoText.id = 'checkpoint-info';
        infoText.style.marginTop = '10px';
        infoText.style.fontSize = '14px';
        infoText.style.padding = '5px';
        infoText.style.borderRadius = '3px';
        infoText.style.backgroundColor = 'rgba(0,0,0,0.3)';
        infoText.textContent = 'Press E to toggle editor';
        controlsDiv.appendChild(infoText);

        document.body.appendChild(controlsDiv);

        // Add keyboard shortcut
        document.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 'e' && window.gameStarted) {
                if (this.isAuthorizedEditor) {
                    this.toggleEditMode();
                } else {
                    console.log('Edit mode denied - not authorized');
                    this.showNotification('Only RJ_4_America can edit checkpoints', true);
                }
            }
        });

        console.log('Checkpoint editor controls created and added to the DOM');
    }

    // Export checkpoint positions to JSON and trigger a download
    exportCheckpointPositions() {
        const configNameInput = document.getElementById('config-name-input');
        const configName = (configNameInput ? configNameInput.value : this.trackConfigName) || 'default';

        const positions = this.checkpoints.map(cp => ({
            x: cp.mesh.position.x,
            y: cp.mesh.position.y,
            z: cp.mesh.position.z
        }));

        const exportData = {
            trackId: 'drift_race_track',
            configName: configName,
            date: new Date().toISOString(),
            positions: positions
        };

        const jsonData = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `track_config_${configName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Simulate saving default config via a server call
        fetch('/save-default-track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonData
        })
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('Failed to save default track configuration');
        })
        .then(data => {
            console.log('Default track saved successfully:', data);
            this.showNotification('Track configuration saved as default for all players');
        })
        .catch(error => {
            console.error('Error saving default track:', error);
            this.showNotification('Note: Default track could not be saved automatically. Please ask RJ to upload the file.', true);
        });

        const infoText = document.getElementById('checkpoint-info');
        if (infoText) {
            infoText.style.backgroundColor = 'rgba(46, 204, 113, 0.3)';
            infoText.textContent = `Exported "${configName}" configuration!`;
            setTimeout(() => {
                infoText.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                infoText.textContent = this.isEditMode ? 'EDIT MODE: Drive near checkpoints to move them' : 'Press E to toggle editor';
            }, 3000);
        }

        console.log(`Exported checkpoint configuration "${configName}":`, positions);
    }

    // Load track config from a JSON file
    async loadTrackConfig(configName) {
        console.log(`Attempting to load track config: ${configName}`);
        try {
            const cacheParam = `?t=${Date.now()}`;
            const response = await fetch(`checkpoints/${configName}.json${cacheParam}`);
            if (!response.ok) {
                console.warn(`Failed to load configuration: ${response.statusText}`);
                if (configName !== 'default') {
                    console.log('Falling back to default configuration');
                    return this.loadTrackConfig('default');
                }
                throw new Error(`Failed to load default configuration: ${response.statusText}`);
            }
            const config = await response.json();
            if (config.positions && Array.isArray(config.positions)) {
                this.checkpointPositions = config.positions;
                this.trackConfigName = config.configName || configName;
                const configNameInput = document.getElementById('config-name-input');
                if (configNameInput) {
                    configNameInput.value = this.trackConfigName;
                }
                console.log(`Loaded checkpoint configuration "${this.trackConfigName}":`, this.checkpointPositions);
                this.cleanupCheckpoints();
                this.createCheckpoints();
                this.showNotification(`Loaded track config: ${this.trackConfigName}`);
                return true;
            } else {
                throw new Error('Invalid configuration format');
            }
        } catch (error) {
            console.error(`Error loading track configuration "${configName}":`, error);
            this.checkpointPositions = [
                { x: 50, y: 3, z: 50 },
                { x: -50, y: 3, z: 50 },
                { x: -50, y: 3, z: -50 },
                { x: 50, y: 3, z: -50 }
            ];
            this.cleanupCheckpoints();
            if (configName !== 'default') {
                this.showNotification(`Failed to load track config: ${configName}`, true);
            }
            this.createCheckpoints();
            return false;
        }
    }

    // Remove existing checkpoints from scene and reset the array
    cleanupCheckpoints() {
        if (!this.checkpoints || !Array.isArray(this.checkpoints)) return;
        console.log('Cleaning up checkpoints:', this.checkpoints.length);
        this.checkpoints.forEach(cp => {
            if (cp.mesh) {
                this.scene.remove(cp.mesh);
                if (cp.mesh.material) cp.mesh.material.dispose();
                if (cp.mesh.geometry) cp.mesh.geometry.dispose();
            }
            if (cp.moveHelper) this.scene.remove(cp.moveHelper);
            if (cp.numberLabel) {
                if (typeof cp.numberLabel.dispose === 'function') cp.numberLabel.dispose();
                this.scene.remove(cp.numberLabel);
            }
        });
        this.checkpoints = [];
    }

    // Toggle checkpoint edit mode
    toggleEditMode() {
        console.log('Toggling checkpoint edit mode. Authorized:', this.isAuthorizedEditor);
        if (!this.isAuthorizedEditor) {
            console.log('Toggle edit mode failed - not authorized');
            this.showNotification('Only RJ_4_America can edit checkpoints', true);
            return;
        }
        this.isEditMode = !this.isEditMode;
        console.log('New edit mode:', this.isEditMode);
        const controlsDiv = document.getElementById('checkpoint-controls');
        const infoText = document.getElementById('checkpoint-info');
        if (infoText) {
            infoText.textContent = this.isEditMode ? 'EDIT MODE: Drive near checkpoints to move them' : 'Press E to toggle editor';
            infoText.style.backgroundColor = this.isEditMode ? 'rgba(231, 76, 60, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        }
        // Update checkpoint visuals
        this.checkpoints.forEach(cp => {
            cp.mesh.material.opacity = this.isEditMode ? 0.8 : 0.4;
            if (cp.moveHelper) {
                cp.moveHelper.visible = this.isEditMode;
            }
        });
        this.showNotification(this.isEditMode ? 'Checkpoint Edit Mode: ON' : 'Checkpoint Edit Mode: OFF');
    }

    // Save checkpoint positions to localStorage
    saveCheckpointPositions() {
        const trackId = 'drift_race_track';
        const configNameInput = document.getElementById('config-name-input');
        const configName = (configNameInput ? configNameInput.value : this.trackConfigName) || 'default';
        const positions = this.checkpoints.map(cp => ({
            x: cp.mesh.position.x,
            y: cp.mesh.position.y,
            z: cp.mesh.position.z
        }));
        const exportData = {
            trackId: trackId,
            configName: configName,
            date: new Date().toISOString(),
            positions: positions
        };
        const jsonData = JSON.stringify(exportData, null, 2);
        localStorage.setItem(`checkpoints_${trackId}`, jsonData);
        this.checkpointPositions = positions;
        const infoText = document.getElementById('checkpoint-info');
        if (infoText) {
            infoText.textContent = 'Checkpoint positions saved!';
            setTimeout(() => {
                infoText.textContent = this.isEditMode ? 'EDIT MODE: Click and drag checkpoints. Press E to exit.' : 'Press E to toggle checkpoint editor';
            }, 2000);
        }
        console.log('Saved checkpoint positions:', positions);
    }

    // Reset checkpoint positions to default values
    resetCheckpointPositions() {
        const defaultPositions = [
            { x: 50, y: 3, z: 50 },
            { x: -50, y: 3, z: 50 },
            { x: -50, y: 3, z: -50 },
            { x: 50, y: 3, z: -50 }
        ];
        this.checkpoints.forEach((checkpoint, index) => {
            const pos = defaultPositions[index];
            checkpoint.mesh.position.set(pos.x, pos.y, pos.z);
            this.updateCheckpointCollider(checkpoint);
        });
        const infoText = document.getElementById('checkpoint-info');
        if (infoText) {
            infoText.textContent = 'Checkpoint positions reset!';
            setTimeout(() => {
                infoText.textContent = this.isEditMode ? 'EDIT MODE: Click and drag checkpoints. Press E to exit.' : 'Press E to toggle checkpoint editor';
            }, 2000);
        }
        console.log('Reset checkpoint positions to defaults');
    }

    // Create checkpoints based on saved or default positions
    createCheckpoints() {
        this.cleanupCheckpoints();
        this.activeCheckpoint = 0;
        const positions = this.checkpointPositions || [
            { x: 50, y: 3, z: 50 },
            { x: -50, y: 3, z: 50 },
            { x: -50, y: 3, z: -50 },
            { x: 50, y: 3, z: -50 }
        ];
        for (let i = 0; i < positions.length; i++) {
            const checkpoint = this.createCheckpoint(positions[i].x, positions[i].y, positions[i].z, i);
            this.checkpoints.push(checkpoint);
        }
        console.log('Created', this.checkpoints.length, 'checkpoints');
        this.updateCheckpointUI();
    }

    // Create a single checkpoint with visual and collision components
    createCheckpoint(x, y, z, index) {
        // Create a translucent ring as the visual cue
        const ringGeometry = new THREE.TorusGeometry(10, 1, 16, 32);
        let color;
        if (index === 0) color = 0x4CAF50;
        else if (index === 1) color = 0x2196F3;
        else if (index === 2) color = 0xFF9800;
        else color = 0x9C27B0;
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.set(x, y, z);
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = false;
        ring.receiveShadow = false;
        ring.userData.isCheckpoint = true;
        ring.userData.checkpointIndex = index;
        this.scene.add(ring);

        // Create an arrow helper for movement in edit mode
        const arrowHelper = this.createArrowHelper(x, y, z, color);
        arrowHelper.visible = false;
        this.scene.add(arrowHelper);

        // Create a label indicating the checkpoint number
        const checkpointNumber = this.createCheckpointNumber(x, y, z, index);
        this.scene.add(checkpointNumber);

        // Create a bounding box as collider
        const checkpointBox = new THREE.Box3().setFromObject(ring);

        return {
            mesh: ring,
            collider: checkpointBox,
            moveHelper: arrowHelper,
            numberLabel: checkpointNumber,
            index: index,
            passed: false
        };
    }

    // Update the collider for a checkpoint after movement
    updateCheckpointCollider(checkpoint) {
        checkpoint.collider = new THREE.Box3().setFromObject(checkpoint.mesh);
        if (checkpoint.moveHelper) {
            checkpoint.moveHelper.position.set(
                checkpoint.mesh.position.x,
                checkpoint.mesh.position.y + 15,
                checkpoint.mesh.position.z
            );
        }
        if (checkpoint.numberLabel) {
            checkpoint.numberLabel.position.set(
                checkpoint.mesh.position.x,
                checkpoint.mesh.position.y + 15,
                checkpoint.mesh.position.z
            );
        }
    }

    // Create a number label above the checkpoint
    createCheckpointNumber(x, y, z, index) {
        const group = new THREE.Group();
        group.position.set(x, y + 15, z);

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        if (index === 0) {
            ctx.strokeStyle = '#4CAF50';
            ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        } else if (index === 1) {
            ctx.strokeStyle = '#2196F3';
            ctx.fillStyle = 'rgba(33, 150, 243, 0.3)';
        } else if (index === 2) {
            ctx.strokeStyle = '#FF9800';
            ctx.fillStyle = 'rgba(255, 152, 0, 0.3)';
        } else {
            ctx.strokeStyle = '#9C27B0';
            ctx.fillStyle = 'rgba(156, 39, 176, 0.3)';
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayText = index === 0 ? 'S' : index.toString();
        ctx.fillText(displayText, 64, 64);
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(10, 10, 1);
        group.add(sprite);
        let animationId;
        const animate = () => {
            group.position.y = y + 15 + Math.sin(Date.now() * 0.001) * 2;
            if (this.camera) {
                const lookAtVector = new THREE.Vector3(0, 0, -1);
                lookAtVector.applyQuaternion(this.camera.quaternion);
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                sprite.rotation.z = Math.atan2(cameraDirection.x, cameraDirection.z);
            }
            animationId = requestAnimationFrame(animate);
        };
        animate();
        group.dispose = () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (material) material.dispose();
            if (texture) texture.dispose();
        };
        return group;
    }

    // Create an arrow helper for moving checkpoints in edit mode
    createArrowHelper(x, y, z, color) {
        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(x, y + 15, z);
        const arrowDir = new THREE.Vector3(0, -1, 0);
        const arrowOrigin = new THREE.Vector3(0, 0, 0);
        const length = 5;
        const arrowHelper = new THREE.ArrowHelper(arrowDir, arrowOrigin, length, color, 2, 1);
        arrowGroup.add(arrowHelper);
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('#', 32, 32);
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: texture });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.set(5, 5, 1);
        label.position.set(0, 2, 0);
        arrowGroup.add(label);
        return arrowGroup;
    }

    // Check if ATV collides with checkpoints (to be called in animation loop)
    checkCheckpoints(atvMesh, chassisBody) {
        if (!atvMesh || this.checkpoints.length === 0) return;

        const atvBox = new THREE.Box3().setFromObject(atvMesh);
        const activeCP = this.checkpoints[this.activeCheckpoint];
        if (activeCP) {
            // Expand the checkpoint collider by 5 units for improved detection tolerance
            const expandedCollider = activeCP.collider.clone().expandByScalar(5);
            if (atvBox.intersectsBox(expandedCollider)) {
                if (!activeCP.passed) {
                    activeCP.passed = true;

                    // Play checkpoint sound
                    this.playSound(activeCP.index === 0 ? 'portalEnter' : 'portalExit');

                    // Show checkpoint message
                    this.showCheckpointMessage(activeCP.index);

                    // Handle lap timing if passing start/finish
                    if (activeCP.index === 0 && this.lastCheckpointTime > 0) {
                        const currentTime = performance.now();
                        this.currentLapTime = (currentTime - this.lastCheckpointTime) / 1000;
                        if (this.currentLapTime < this.bestLapTime) {
                            this.bestLapTime = this.currentLapTime;
                            this.showLapTimeMessage(this.currentLapTime, true);
                        } else {
                            this.showLapTimeMessage(this.currentLapTime, false);
                        }
                    }

                    if (activeCP.index === 0) {
                        this.lastCheckpointTime = performance.now();
                    }
                    
                    this.activeCheckpoint = (this.activeCheckpoint + 1) % this.checkpoints.length;
                    this.updateCheckpointUI();
                }
            } else {
                // If ATV moves away, reset the passed flag
                if (activeCP.passed) {
                    const distanceToActiveCP = atvBox.getCenter(new THREE.Vector3()).distanceTo(expandedCollider.getCenter(new THREE.Vector3()));
                    if (distanceToActiveCP > 20) {
                        activeCP.passed = false;
                    }
                }
            }
        }
        
        // In edit mode, allow moving checkpoints if authorized
        if (this.isEditMode && this.isAuthorizedEditor && chassisBody) {
            for (let i = 0; i < this.checkpoints.length; i++) {
                const cp = this.checkpoints[i];
                const distanceToCP = atvBox.getCenter(new THREE.Vector3()).distanceTo(cp.collider.getCenter(new THREE.Vector3()));
                if (distanceToCP < 15) {
                    if (window.controls && window.controls.forward && !window.controls.backward) {
                        cp.mesh.position.set(chassisBody.position.x, Math.max(3, chassisBody.position.y), chassisBody.position.z);
                        this.updateCheckpointCollider(cp);
                        console.log('Moving checkpoint', i, 'to', cp.mesh.position);
                    }
                    cp.mesh.material.emissiveIntensity = 0.8;
                } else {
                    cp.mesh.material.emissiveIntensity = 0.3;
                }
            }
        }
    }

    // Show a message when a checkpoint is passed
    showCheckpointMessage(checkpointIndex) {
        const isMobile = window.isMobileDevice;
        const message = document.createElement('div');
        message.style.position = 'absolute';
        if (isMobile) {
            message.style.top = '70px';
            message.style.left = '50%';
            message.style.transform = 'translateX(-50%)';
            message.style.padding = '10px 15px';
            message.style.fontSize = '18px';
            message.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        } else {
            message.style.top = '30%';
            message.style.left = '50%';
            message.style.transform = 'translateX(-50%)';
            message.style.padding = '20px 30px';
            message.style.fontSize = '24px';
            message.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        }
        message.style.backgroundColor = 'rgba(46, 204, 113, 0.9)';
        message.style.color = 'white';
        message.style.borderRadius = '5px';
        message.style.zIndex = '2000';
        message.style.fontFamily = 'Arial, sans-serif';
        message.textContent = `Checkpoint ${checkpointIndex} passed!`;
        document.body.appendChild(message);
        setTimeout(() => {
            message.style.transition = 'opacity 0.5s ease-out';
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 500);
        }, 3000);
    }

    // Placeholder for lap time message (implementation-dependent)
    showLapTimeMessage(lapTime, isBest) {
        console.log(`Lap time: ${lapTime} seconds. ${isBest ? 'New Best!' : ''}`);
    }

    // Update checkpoint UI; can be overridden externally
    updateCheckpointUI() {
        if (typeof this._updateCheckpointUI === 'function') {
            this._updateCheckpointUI();
        } else {
            console.log('Checkpoint UI updated');
        }
    }
}

// Export the class for use in other modules
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = CheckpointManager;
} else {
    window.CheckpointManager = CheckpointManager;
}
