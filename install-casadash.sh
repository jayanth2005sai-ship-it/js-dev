#!/bin/bash
set -e

# Colors for the CLI
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${GREEN}             🚀 CasaDash Installer 🚀              ${NC}"
echo -e "${BLUE}=====================================================${NC}"

echo -e "\n${YELLOW}[1/6] Installing System Dependencies...${NC}"
sudo apt-get update -y
sudo apt-get install -y curl git ufw

echo -e "\n${YELLOW}[2/6] Installing Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js is already installed."
fi

echo -e "\n${YELLOW}[3/6] Configuring Firewall (Opening Port 3000)...${NC}"
sudo ufw allow 3000/tcp
sudo ufw --force enable

echo -e "\n${YELLOW}[4/6] Downloading CasaDash...${NC}"
echo -e "${GREEN}Please paste your GitHub Repository URL below:${NC}"
read -p "> " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ Error: URL cannot be empty. Please run the script again."
    exit 1
fi

# Remove old folder if it exists and clone the new one
rm -rf ~/casadash
git clone "$REPO_URL" ~/casadash
cd ~/casadash

echo -e "\n${YELLOW}[5/6] Configuring Environment & Building...${NC}"
# Generate a persistent JWT Secret if it doesn't exist
if [ ! -f .env ]; then
    echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
    echo "✅ Generated secure JWT_SECRET in .env"
fi

npm install
npm run build

echo -e "\n${YELLOW}[6/6] Starting CasaDash with PM2...${NC}"
# Install PM2 to keep the app running forever
sudo npm install -g pm2
pm2 stop casadash 2>/dev/null || true
# Use npm to start the app so it picks up the package.json scripts correctly
pm2 start npm --name "casadash" -- start
pm2 save
sudo pm2 startup | grep "sudo env" | bash || true

# Fetch IP Addresses
PUBLIC_IP=$(curl -s https://ifconfig.me)
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo -e "\n${BLUE}=====================================================${NC}"
echo -e "${GREEN}         ✅ CasaDash Installed Successfully!         ${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo -e "Your dashboard is now running in the background."
echo -e "You can safely close this terminal.\n"
echo -e "Access your dashboard here:"
echo -e "🌍 Public URL: ${GREEN}http://${PUBLIC_IP}:3000${NC}"
echo -e "🏠 Local URL:  ${GREEN}http://${LOCAL_IP}:3000${NC}\n"
echo -e "🔒 ${YELLOW}Login using your Ubuntu Server Username and Password.${NC}"
echo -e "${BLUE}=====================================================${NC}"
