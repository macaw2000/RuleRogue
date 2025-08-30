#!/bin/bash

# AWS Deployment Script for Multiplayer Roguelike
# Make sure you have AWS CLI configured with appropriate permissions

set -e

echo "🚀 Deploying Multiplayer Roguelike to AWS..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo "❌ Elastic Beanstalk CLI is not installed. Please install it first."
    echo "Run: pip install awsebcli"
    exit 1
fi

# Initialize EB application if not already done
if [ ! -f .elasticbeanstalk/config.yml ]; then
    echo "📝 Initializing Elastic Beanstalk application..."
    eb init multiplayer-roguelike --platform node.js --region us-east-1
fi

# Create environment if it doesn't exist
if ! eb list | grep -q "roguelike-prod"; then
    echo "🏗️  Creating production environment..."
    eb create roguelike-prod --instance-type t3.micro --envvars NODE_ENV=production
else
    echo "📦 Deploying to existing environment..."
    eb deploy roguelike-prod
fi

echo "✅ Deployment complete!"
echo "🌐 Your game will be available at the URL shown above"
echo "💡 Share this URL with your brothers to play together!"