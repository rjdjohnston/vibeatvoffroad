# Vibe ATV Off-road Game - Docker Deployment Guide

This document outlines how to build, run, and deploy the Vibe ATV Off-road game using Docker containers.

## Prerequisites

- Docker installed on your system
- Docker Compose installed on your system (included with Docker Desktop)

## Local Development

To run the game locally with Docker for development:

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The game will be available at http://localhost:3000

## Production Deployment

### Option 1: Docker Compose (Recommended for simple deployments)

1. Copy the entire project directory to your server
2. Run the following commands on your server:

```bash
cd /path/to/vibeatvoffroad
docker-compose up -d
```

### Option 2: Manual Docker Deployment

1. Build the Docker image:

```bash
docker build -t vibe-atv-game .
```

2. Run the container:

```bash
docker run -d -p 3000:3000 --name vibe-atv-game vibe-atv-game
```

## Cloud Deployment Options

### AWS Elastic Container Service (ECS)

1. Push your Docker image to Amazon ECR:

```bash
aws ecr create-repository --repository-name vibe-atv-game
aws ecr get-login-password | docker login --username AWS --password-stdin [your-aws-account-id].dkr.ecr.[region].amazonaws.com
docker tag vibe-atv-game:latest [your-aws-account-id].dkr.ecr.[region].amazonaws.com/vibe-atv-game:latest
docker push [your-aws-account-id].dkr.ecr.[region].amazonaws.com/vibe-atv-game:latest
```

2. Create an ECS cluster, task definition, and service using the AWS Console or CLI

### Digital Ocean App Platform

1. Push your code to a GitHub repository
2. Connect your GitHub account to Digital Ocean
3. Create a new App and select your repository
4. Choose the Docker source type and configure port 3000

## Environment Variables

The following environment variables can be configured:

- `PORT`: The port the server listens on (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## Container Management

### View running containers
```bash
docker ps
```

### Stop container
```bash
docker stop vibe-atv-game
```

### Restart container
```bash
docker restart vibe-atv-game
```

### View container logs
```bash
docker logs -f vibe-atv-game
```
