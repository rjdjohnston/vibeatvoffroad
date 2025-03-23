# Vibe ATV Off-road

A multiplayer 3D ATV off-road racing game built with Three.js, CANNON.js, and Socket.IO.

## Features

- Real-time multiplayer racing with Socket.IO
- Advanced physics with CANNON.js
- 3D graphics with Three.js
- Customizable player names and colors
- Stunt ramps and jump tracking
- Scoreboard and player statistics

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

## Game Physics

The ATV physics system has been tuned for an arcade-style driving experience with:
- Dramatic visual tilting effects during turns
- Stable handling to prevent excessive flipping
- Widened chassis for better stability
- Responsive controls for fun gameplay

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
