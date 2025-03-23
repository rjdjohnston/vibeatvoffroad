#!/bin/bash

# Exit on error
set -e

# Display help message
function show_help {
  echo "Vibe ATV Off-road SSL Setup Script"
  echo ""
  echo "This script helps set up SSL certificates using Let's Encrypt certbot or self-signed certificates."
  echo "It also configures your Docker environment to use the certificates."
  echo ""
  echo "Usage: ./setup-ssl.sh [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help       Show this help message"
  echo "  -s, --staging    Use Let's Encrypt staging environment (for testing)"
  echo "  -p, --production Use Let's Encrypt production environment"
  echo "  -l, --local      Use local directories (no sudo required)"
  echo "  -ss, --self-signed Generate self-signed certificates (for local development)"
  echo "  -d, --domain     Specify your domain (e.g. vibeatv.example.com)"
  echo ""
  echo "Note: For Let's Encrypt certificates, certbot must be installed on your system."
  echo "      You can install it using: brew install certbot (macOS) or sudo apt-get install certbot (Linux)"
  echo ""
  echo "If you encounter permission errors, you can either:"
  echo "  1. Run this script with sudo: sudo ./setup-ssl.sh [options]"
  echo "  2. Use the --local option to use local directories: ./setup-ssl.sh --local [options]"
  echo "  3. Use the --self-signed option for local development: ./setup-ssl.sh --self-signed"
  echo ""
}

# Check if certbot is installed
function check_certbot {
  if ! command -v certbot &> /dev/null; then
    echo "Error: certbot is not installed!"
    echo "Please install certbot using your package manager."
    echo "For macOS: brew install certbot"
    echo "For Linux: sudo apt-get install certbot"
    exit 1
  fi
}

# Check if openssl is installed
function check_openssl {
  if ! command -v openssl &> /dev/null; then
    echo "Error: openssl is not installed!"
    echo "Please install openssl using your package manager."
    echo "For macOS: brew install openssl"
    echo "For Linux: sudo apt-get install openssl"
    exit 1
  fi
}

# Check if docker and docker-compose are installed
function check_docker {
  if ! command -v docker &> /dev/null; then
    echo "Error: docker is not installed!"
    echo "Please install docker before continuing."
    exit 1
  fi

  if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed!"
    echo "Please install docker-compose before continuing."
    exit 1
  fi
}

# Create SSL directory if it doesn't exist
function create_ssl_dir {
  if [ ! -d "certs" ]; then
    mkdir -p certs
    echo "Created certs directory."
  fi
}

# Create local directories for certbot
function create_local_dirs {
  mkdir -p ./certbot/config
  mkdir -p ./certbot/work
  mkdir -p ./certbot/logs
  echo "Created local directories for certbot."
}

# Generate self-signed certificates
function generate_self_signed_certs {
  echo "Generating self-signed certificates for local development..."
  
  # Create SSL directory
  create_ssl_dir
  
  # Generate certificate
  echo "Generating self-signed certificate for $DOMAIN..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/server.key -out certs/server.crt \
    -subj "/C=US/ST=State/L=City/O=Vibe ATV Off-road/OU=Development/CN=$DOMAIN"
  
  echo "Self-signed certificates generated and saved to certs directory."
  
  # Update docker-compose.yml to use the certificates
  update_docker_compose
}

# Generate certificates using Let's Encrypt staging environment
function generate_staging_certs {
  echo "Generating certificates using Let's Encrypt staging environment..."
  
  local CERTBOT_ARGS="--standalone --test-cert --agree-tos --no-eff-email -m admin@$DOMAIN"
  
  if [ "$USE_LOCAL_DIRS" = "yes" ]; then
    create_local_dirs
    CERTBOT_ARGS="$CERTBOT_ARGS --config-dir ./certbot/config --work-dir ./certbot/work --logs-dir ./certbot/logs"
    CERT_PATH="./certbot/config/live"
  else
    CERT_PATH="/etc/letsencrypt/live"
  fi
  
  # Generate certificate for domain
  echo "Generating certificate for $DOMAIN..."
  certbot certonly $CERTBOT_ARGS -d $DOMAIN
  
  # Copy certificates to certs directory
  create_ssl_dir
  echo "Copying certificates to certs directory..."
  cp "$CERT_PATH/$DOMAIN/fullchain.pem" certs/server.crt
  cp "$CERT_PATH/$DOMAIN/privkey.pem" certs/server.key
  
  echo "Certificates generated and copied to certs directory."
  
  # Update docker-compose.yml to use the certificates
  update_docker_compose
}

# Generate certificates using Let's Encrypt production environment
function generate_production_certs {
  echo "Generating certificates using Let's Encrypt production environment..."
  
  local CERTBOT_ARGS="--standalone --agree-tos --no-eff-email -m admin@$DOMAIN"
  
  if [ "$USE_LOCAL_DIRS" = "yes" ]; then
    create_local_dirs
    CERTBOT_ARGS="$CERTBOT_ARGS --config-dir ./certbot/config --work-dir ./certbot/work --logs-dir ./certbot/logs"
    CERT_PATH="./certbot/config/live"
  else
    CERT_PATH="/etc/letsencrypt/live"
  fi
  
  # Generate certificate for domain
  echo "Generating certificate for $DOMAIN..."
  certbot certonly $CERTBOT_ARGS -d $DOMAIN
  
  # Copy certificates to certs directory
  create_ssl_dir
  echo "Copying certificates to certs directory..."
  cp "$CERT_PATH/$DOMAIN/fullchain.pem" certs/server.crt
  cp "$CERT_PATH/$DOMAIN/privkey.pem" certs/server.key
  
  echo "Certificates generated and copied to certs directory."
  
  # Update docker-compose.yml to use the certificates
  update_docker_compose
}

# Update the docker-compose.yml file to use the SSL certificates
function update_docker_compose {
  echo "Updating docker-compose.yml to use SSL certificates..."
  
  # Check if docker-compose.yml exists
  if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found!"
    exit 1
  fi
  
  # Make a backup of the original file
  cp docker-compose.yml docker-compose.yml.bak
  
  # Uncomment SSL certificate volume mounts and environment variables
  sed -i.bak \
    -e 's/# - \.\/certs\/server\.key:\/app\/certs\/server\.key/- \.\/certs\/server\.key:\/app\/certs\/server\.key/g' \
    -e 's/# - \.\/certs\/server\.crt:\/app\/certs\/server\.crt/- \.\/certs\/server\.crt:\/app\/certs\/server\.crt/g' \
    -e 's/# - SSL_KEY_PATH=\/app\/certs\/server\.key/- SSL_KEY_PATH=\/app\/certs\/server\.key/g' \
    -e 's/# - SSL_CERT_PATH=\/app\/certs\/server\.crt/- SSL_CERT_PATH=\/app\/certs\/server\.crt/g' \
    docker-compose.yml
  
  echo "docker-compose.yml updated. Original file backed up as docker-compose.yml.bak"
}

# Setup auto-renewal for Let's Encrypt certificates
function setup_auto_renewal {
  if [ "$MODE" = "production" ] || [ "$MODE" = "staging" ]; then
    echo "Setting up auto-renewal for Let's Encrypt certificates..."
    
    # Create renewal script
    cat > renew-certs.sh << 'EOF'
#!/bin/bash

# Renew certificates
certbot renew --quiet

# Copy renewed certificates to certs directory
DOMAIN="your-domain-here"
CERT_PATH="/etc/letsencrypt/live"

# Copy if certificates exist and have been renewed
if [ -f "$CERT_PATH/$DOMAIN/fullchain.pem" ] && [ -f "$CERT_PATH/$DOMAIN/privkey.pem" ]; then
  cp "$CERT_PATH/$DOMAIN/fullchain.pem" certs/server.crt
  cp "$CERT_PATH/$DOMAIN/privkey.pem" certs/server.key
  
  # Restart Docker containers to apply new certificates
  docker-compose restart
fi
EOF
    
    # Replace placeholder with actual domain
    sed -i.bak "s/your-domain-here/$DOMAIN/g" renew-certs.sh
    
    # Make the script executable
    chmod +x renew-certs.sh
    
    echo "Created renew-certs.sh script for certificate renewal."
    echo "To set up automatic renewal, add the following line to your crontab:"
    echo "0 3 * * * /path/to/your/project/renew-certs.sh"
    echo ""
    echo "You can edit your crontab with: crontab -e"
  fi
}

# Parse command line arguments
if [ $# -eq 0 ]; then
  show_help
  exit 0
fi

USE_LOCAL_DIRS="no"
MODE=""
DOMAIN="localhost"  # Default domain

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -l|--local)
      USE_LOCAL_DIRS="yes"
      shift
      ;;
    -s|--staging)
      MODE="staging"
      shift
      ;;
    -p|--production)
      MODE="production"
      shift
      ;;
    -ss|--self-signed)
      MODE="self-signed"
      shift
      ;;
    -d|--domain)
      if [ -n "$2" ]; then
        DOMAIN="$2"
        shift 2
      else
        echo "Error: --domain requires an argument."
        exit 1
      fi
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Check for required applications
check_docker

# Generate certificates based on mode
if [ "$MODE" = "staging" ]; then
  check_certbot
  generate_staging_certs
  setup_auto_renewal
elif [ "$MODE" = "production" ]; then
  check_certbot
  generate_production_certs
  setup_auto_renewal
elif [ "$MODE" = "self-signed" ]; then
  check_openssl
  generate_self_signed_certs
else
  show_help
  exit 1
fi

echo ""
echo "SSL setup complete!"
echo "To use HTTPS with your Vibe ATV Off-road game, restart your Docker containers:"
echo "docker-compose down && docker-compose up -d"
