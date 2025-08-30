@echo off
REM Serverless AWS Deployment Script for Multiplayer Roguelike (Windows)

echo 🚀 Deploying Serverless Multiplayer Roguelike to AWS...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install it first.
    exit /b 1
)

REM Check if AWS CLI is installed
aws --version >nul 2>&1
if errorlevel 1 (
    echo ❌ AWS CLI is not installed. Please install it first.
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Deploy serverless infrastructure
echo 🏗️  Deploying serverless functions and infrastructure...
npx serverless deploy

if errorlevel 1 (
    echo ❌ Serverless deployment failed!
    exit /b 1
)

REM Get the WebSocket URL and S3 bucket name
echo 📝 Getting deployment info...
for /f "tokens=*" %%i in ('npx serverless info --verbose ^| findstr "WebSocketURI"') do set WEBSOCKET_URL=%%i
for /f "tokens=*" %%i in ('npx serverless info --verbose ^| findstr "WebsiteBucket"') do set BUCKET_NAME=%%i

REM Deploy static website to S3
echo 🌐 Deploying website to S3...
aws s3 sync public/ s3://multiplayer-roguelike-website-prod --delete

REM Enable website hosting
aws s3 website s3://multiplayer-roguelike-website-prod --index-document index.html --error-document error.html

echo ✅ Deployment complete!
echo 🌐 Your game is available at: http://multiplayer-roguelike-website-prod.s3-website-us-east-1.amazonaws.com
echo 💡 Share this URL with your brothers to play together!
echo 💰 Estimated monthly cost: $1-5 (pay only for what you use!)

pause