#!/bin/bash

# Catalogo ML - SSL Certificate Generation Script

# Color definitions for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
DOMAIN_NAME=${1:-"localhost"}
EMAIL=${2:-"admin@example.com"}
INSTALL_DIR=${INSTALL_DIR:-"/opt/catalogo"}

# Function to display usage information
function show_usage {
  echo -e "${BLUE}Catalogo ML - SSL Certificate Generation Script${NC}"
  echo -e "Usage: $0 <domain-name> <email>"
  echo -e "Example: $0 example.com admin@example.com"
}

# Check if domain name is provided
if [[ "$DOMAIN_NAME" == "localhost" ]]; then
  echo -e "${YELLOW}Warning: Using 'localhost' as domain name.${NC}"
  echo -e "${YELLOW}This is fine for testing but not recommended for production.${NC}"
  echo -e "${YELLOW}Consider providing a real domain name.${NC}"
  echo
  show_usage
  echo
  read -p "Continue with localhost? (y/n): " continue_localhost
  if [[ "$continue_localhost" != "y" && "$continue_localhost" != "Y" ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
  fi
fi

# Function to check if a command exists
function command_exists {
  command -v "$1" >/dev/null 2>&1
}

# Check if certbot is installed
if ! command_exists certbot; then
  echo -e "${YELLOW}Certbot not found. Installing...${NC}"
  apt-get update
  apt-get install -y certbot
else
  echo -e "${GREEN}Certbot is already installed.${NC}"
fi

# Create SSL directory
mkdir -p "$INSTALL_DIR/nginx/ssl"

# Generate self-signed certificate for localhost or testing
if [[ "$DOMAIN_NAME" == "localhost" || "$DOMAIN_NAME" == "127.0.0.1" ]]; then
  echo -e "${YELLOW}Generating self-signed certificate for $DOMAIN_NAME...${NC}"
  
  # Check if openssl is installed
  if ! command_exists openssl; then
    echo -e "${YELLOW}OpenSSL not found. Installing...${NC}"
    apt-get update
    apt-get install -y openssl
  fi
  
  # Generate self-signed certificate
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$INSTALL_DIR/nginx/ssl/key.pem" \
    -out "$INSTALL_DIR/nginx/ssl/cert.pem" \
    -subj "/CN=$DOMAIN_NAME/O=Catalogo ML/C=BR"
  
  echo -e "${GREEN}Self-signed certificate generated successfully.${NC}"
  echo -e "${YELLOW}Note: Self-signed certificates will show security warnings in browsers.${NC}"
  
  # Set permissions
  chmod 600 "$INSTALL_DIR/nginx/ssl/key.pem"
  chmod 644 "$INSTALL_DIR/nginx/ssl/cert.pem"
else
  # Generate Let's Encrypt certificate for production
  echo -e "${YELLOW}Generating Let's Encrypt certificate for $DOMAIN_NAME...${NC}"
  
  # Check if the domain is accessible
  echo -e "${YELLOW}Checking if $DOMAIN_NAME is accessible...${NC}"
  if ! ping -c 1 "$DOMAIN_NAME" &> /dev/null; then
    echo -e "${RED}Warning: Could not ping $DOMAIN_NAME.${NC}"
    echo -e "${YELLOW}Make sure the domain is properly configured and points to this server.${NC}"
    read -p "Continue anyway? (y/n): " continue_anyway
    if [[ "$continue_anyway" != "y" && "$continue_anyway" != "Y" ]]; then
      echo -e "${RED}Aborted.${NC}"
      exit 1
    fi
  fi
  
  # Stop Nginx if it's running
  echo -e "${YELLOW}Stopping Nginx if it's running...${NC}"
  docker compose -f "$INSTALL_DIR/docker-compose.prod.yml" down nginx || true
  
  # Generate certificate using certbot
  echo -e "${YELLOW}Generating certificate using certbot...${NC}"
  certbot certonly --standalone \
    --preferred-challenges http \
    --agree-tos \
    --email "$EMAIL" \
    --domain "$DOMAIN_NAME" \
    --non-interactive
  
  # Check if certificate was generated successfully
  if [[ $? -ne 0 ]]; then
    echo -e "${RED}Failed to generate certificate.${NC}"
    echo -e "${YELLOW}You can try again later or use a self-signed certificate for testing.${NC}"
    exit 1
  fi
  
  # Copy certificates to Nginx SSL directory
  echo -e "${YELLOW}Copying certificates to Nginx SSL directory...${NC}"
  cp "/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem" "$INSTALL_DIR/nginx/ssl/key.pem"
  cp "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" "$INSTALL_DIR/nginx/ssl/cert.pem"
  
  # Set permissions
  chmod 600 "$INSTALL_DIR/nginx/ssl/key.pem"
  chmod 644 "$INSTALL_DIR/nginx/ssl/cert.pem"
  
  # Create renewal hook
  echo -e "${YELLOW}Creating renewal hook...${NC}"
  mkdir -p /etc/letsencrypt/renewal-hooks/post
  cat > "/etc/letsencrypt/renewal-hooks/post/catalogo-copy-certs.sh" << EOF
#!/bin/bash
cp "/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem" "$INSTALL_DIR/nginx/ssl/key.pem"
cp "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" "$INSTALL_DIR/nginx/ssl/cert.pem"
chmod 600 "$INSTALL_DIR/nginx/ssl/key.pem"
chmod 644 "$INSTALL_DIR/nginx/ssl/cert.pem"
docker compose -f "$INSTALL_DIR/docker-compose.prod.yml" restart nginx
EOF
  chmod +x "/etc/letsencrypt/renewal-hooks/post/catalogo-copy-certs.sh"
  
  # Add cron job for certificate renewal
  echo -e "${YELLOW}Adding cron job for certificate renewal...${NC}"
  (crontab -l 2>/dev/null || echo "") | grep -v "certbot renew" | { cat; echo "0 3 * * * certbot renew --quiet"; } | crontab -
  
  echo -e "${GREEN}Let's Encrypt certificate generated successfully.${NC}"
fi

echo -e "${BLUE}=================================${NC}"
echo -e "${GREEN}SSL Certificate Generation Complete${NC}"
echo -e "${BLUE}=================================${NC}"
echo -e "${YELLOW}To use the certificate with the deployment script, run:${NC}"
echo -e "./deploy-production.sh --domain-name $DOMAIN_NAME --use-ssl --ssl-cert $INSTALL_DIR/nginx/ssl/cert.pem --ssl-key $INSTALL_DIR/nginx/ssl/key.pem"
