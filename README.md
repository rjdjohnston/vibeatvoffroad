# Vibe ATV Off-road

A multiplayer 3D ATV off-road racing game built with Three.js, CANNON.js, and Socket.IO.

## Features

- Real-time multiplayer racing with Socket.IO
- Advanced physics with CANNON.js
- 3D graphics with Three.js
- Customizable player names and colors
- Stunt ramps and jump tracking
- Scoreboard and player statistics
- Racing checkpoint system with lap timing
- Official track editor only available to RJ_4_America

## Development Setup

### Prerequisites

- Node.js (v14+)
- Docker and Docker Compose (for containerized deployment)

### Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   node server.js
   ```
4. Open your browser and visit: http://localhost:8090

## Docker Deployment

The game can be deployed using Docker for easier setup and deployment.

1. Build and start the containers:
   ```
   docker compose up -d
   ```
2. Open your browser and visit: http://localhost:8090

## SSL/HTTPS Setup

The game supports HTTPS for secure connections. Use the provided script to set up SSL certificates.

### SSL Setup Script

The `setup-ssl.sh` script automates the SSL certificate setup process while ensuring compatibility with the Docker environment.

#### Key Features:

1. **Multiple Certificate Options**:
   - Self-signed certificates for development
   - Let's Encrypt staging certificates for testing
   - Let's Encrypt production certificates for deployment

2. **Docker Integration**:
   - Automatically updates your docker-compose.yml file
   - Sets up proper volume mounts for certificates
   - Configures environment variables for the server.js code

3. **Certificate Auto-renewal**:
   - Creates a renew-certs.sh script for automatic renewal
   - Provides instructions for setting up a cron job

4. **Domain Customization**:
   - Allows specifying your domain with the `-d` parameter

#### Usage Examples:

```bash
# For local development with self-signed certificates
./setup-ssl.sh --self-signed

# For staging environment with Let's Encrypt (testing)
./setup-ssl.sh --staging --domain yourdomain.com

# For production with Let's Encrypt
./setup-ssl.sh --production --domain yourdomain.com
```

After setting up SSL, restart your Docker containers to apply the changes:

```bash
docker compose down && docker compose up -d
```

## Game Controls

- **W / Up Arrow**: Accelerate
- **S / Down Arrow**: Brake/Reverse
- **A / Left Arrow**: Turn left
- **D / Right Arrow**: Turn right
- **Space**: Jump/Boost
- **R**: Reset position (if stuck)
- **E**: Toggle checkpoint edit mode (RJ_4_America only)

## Checkpoint System

The game includes a racing checkpoint system with customizable checkpoint positions and lap timing.

### Features

- Race through 4 checkpoints positioned around the track
- Lap timing with best lap tracking
- Visual indicators for active checkpoint
- Special track editor mode for RJ_4_America only
- Visible checkpoint numbers with color coding:
  - Start/Finish: Green with "S" label
  - Checkpoint 1: Blue with "1" label
  - Checkpoint 2: Orange with "2" label
  - Checkpoint 3: Purple with "3" label

### Checkpoint Editor (RJ_4_America Only)

The checkpoint editor is restricted to the player named "RJ_4_America". This ensures consistent checkpoint placement for all players.

When playing as RJ_4_America:
1. Press **E** to toggle checkpoint editor mode
2. Drive near a checkpoint and move forward to position it
3. Use the editor panel (bottom right) to save or export positions
4. JSON configuration files are stored in the `checkpoints/` directory

### Configuration Files

The game loads checkpoint configurations from JSON files in the `checkpoints/` directory:

- `default.json` is used for all regular players
- Only RJ_4_America can modify checkpoint positions

### JSON Format

```json
{
  "trackId": "drift_race_track",
  "configName": "my_track",
  "date": "2024-03-25T12:00:00.000Z",
  "positions": [
    { "x": 50, "y": 3, "z": 50 },
    { "x": -50, "y": 3, "z": 50 },
    { "x": -50, "y": 3, "z": -50 },
    { "x": 50, "y": 3, "z": -50 }
  ]
}
```

## Game Physics

The ATV physics system has been tuned for an arcade-style driving experience with:
- Dramatic visual tilting effects during turns
- Stable handling to prevent excessive flipping
- Widened chassis for better stability
- Responsive controls for fun gameplay

## Ramp Creation Functions

The game provides two specialized functions for creating ramps with different properties:

### `createRamp(x, z, width, height, depth, angle, axis, color)`

Creates a standard ramp with rotation on a specified axis.

| Parameter | Type | Description |
|-----------|------|-------------|
| `x` | Number | X position of the ramp |
| `z` | Number | Z position of the ramp |
| `width` | Number | Width of the ramp in game units |
| `height` | Number | Height of the ramp in game units |
| `depth` | Number | Depth/length of the ramp in game units |
| `angle` | Number | Angle of inclination in radians (typically Math.PI/12 for a 15° slope) |
| `axis` | String | Axis of rotation: 'x' for north/south facing ramps, 'z' for east/west facing ramps |
| `color` | Hex | Hexadecimal color code (e.g., 0xFF0000 for red) |

Example usage:
```javascript
// Create a north-facing red ramp
createRamp(0, 680, 40, 15, 50, Math.PI/12, 'x', 0xFF0000);

// Create a west-facing yellow ramp
createRamp(-50, -50, 30, 15, 50, Math.PI/12, 'z', 0xFFFF00);
```

### `createPortalRamp(x, z, width, height, depth, angle, elevation, color)`

Creates an elevated ramp with customizable height above ground, always rotated on the x-axis.

| Parameter | Type | Description |
|-----------|------|-------------|
| `x` | Number | X position of the ramp |
| `z` | Number | Z position of the ramp |
| `width` | Number | Width of the ramp in game units |
| `height` | Number | Height/thickness of the ramp in game units |
| `depth` | Number | Depth/length of the ramp in game units |
| `angle` | Number | Angle of inclination in radians |
| `elevation` | Number | Height above ground level in game units |
| `color` | Hex | Hexadecimal color code (e.g., 0x8A2BE2 for purple) |

Example usage:
```javascript
// Create a purple portal ramp elevated 2 units above ground
createPortalRamp(-200, -250, 45, 5, 60, Math.PI/12, 2, 0x8A2BE2);
```

Both functions create physics bodies with proper collision detection and visual meshes with matching appearance.

## Project Structure

- `server.js`: Backend server using Express and Socket.IO
- `script.js`: Main game logic, physics, and scene setup
- `multiplayer.js`: Multiplayer functionality and player synchronization
- `index.html`: Main game interface
- `style.css`: Game styling
- `Dockerfile` and `docker-compose.yml`: Docker configuration

## Environment Variables

- `PORT`: Server port (default: 8090)
- `SSL_KEY_PATH`: Path to SSL key file (for HTTPS)
- `SSL_CERT_PATH`: Path to SSL certificate file (for HTTPS)

## License

MIT
