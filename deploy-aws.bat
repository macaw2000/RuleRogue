@echo off
REM AWS Deployment Script for Multiplayer Roguelike (Windows)
REM Make sure you have AWS CLI configured with appropriate permissions

echo 🚀 Deploying Multiplayer Roguelike to AWS...

REM Check if AWS CLI is installed
aws --version >nul 2>&1
if errorlevel 1 (
    echo ❌ AWS CLI is not installed. Please install it first.
    exit /b 1
)

REM Check if EB CLI is installed
eb --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Elastic Beanstalk CLI is not installed. Please install it first.
    echo Run: pip install awsebcli
    exit /b 1
)

REM Initialize EB application if not already done
if not exist .elasticbeanstalk\config.yml (
    echo 📝 Initializing Elastic Beanstalk application...
    eb init multiplayer-roguelike --platform node.js --region us-east-1
)

REM Create environment if it doesn't exist
eb list | findstr "roguelike-prod" >nul
if errorlevel 1 (
    echo 🏗️  Creating production environment...
    eb create roguelike-prod --instance-type t3.micro --envvars NODE_ENV=production
) else (
    echo 📦 Deploying to existing environment...
    eb deploy roguelike-prod
)

echo ✅ Deployment complete!
echo 🌐 Your game will be available at the URL shown above
echo 💡 Share this URL with your brothers to play together!