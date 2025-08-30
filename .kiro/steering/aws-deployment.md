# AWS Deployment Requirements

## CRITICAL DEPLOYMENT RULES - ALWAYS FOLLOW

⚠️ **NEVER suggest running `python -m http.server`, `npm start`, or any local development server**
⚠️ **NEVER mention localhost, 127.0.0.1, or local URLs as solutions**
⚠️ **ALWAYS deploy to AWS and provide AWS URLs for testing**
⚠️ **ALWAYS use `aws s3 cp` for frontend updates (takes 2 seconds vs 60+ seconds CloudFormation)**

## Deployment Target

- This multiplayer roguelike game MUST ALWAYS be designed for AWS deployment
- All testing MUST be done on AWS-hosted URLs, never locally
- All configuration, documentation, and code should assume AWS as the target environment
- When making changes, IMMEDIATELY upload to S3 and provide the AWS URL for testing

## AWS Services to Use

### For This Project (Current Setup):

- **S3 Static Hosting** for frontend files (HTML, CSS, JS) - FAST deployment with `aws s3 cp`
- **Lambda + API Gateway** for WebSocket backend - Use `serverless deploy function` for quick updates
- **DynamoDB** for game state storage

### Alternative Fast Deployment Options:

- **AWS App Runner** for containerized deployment (faster than CloudFormation)
- **AWS Elastic Beanstalk** for traditional web apps
- **AWS Amplify** for full-stack apps with CI/CD

### Avoid for Speed:

- **CloudFormation full stack deployments** (60+ seconds) - Only use for infrastructure changes
- **AWS CDK** - Good for infrastructure, slow for code changes

## Configuration Requirements

- Use environment variables for all configuration
- Include AWS deployment scripts and configuration files
- Ensure the application binds to `0.0.0.0` and uses `process.env.PORT`
- Include health check endpoints for AWS load balancers
- Configure proper logging for AWS CloudWatch

## Documentation & Testing Protocol

### MANDATORY Testing Process:

1. Make code changes locally
2. IMMEDIATELY deploy to AWS using fast methods:
   - Frontend: `aws s3 cp public/file.js s3://bucket-name/file.js` (2 seconds)
   - Backend: `serverless deploy function --function functionName` (5-10 seconds)
3. Provide AWS URL for user testing: `http://multiplayer-roguelike-website-prod.s3-website-us-east-1.amazonaws.com`
4. NEVER ask user to run anything locally

### Documentation Requirements:

- Always include AWS deployment instructions
- Provide AWS-specific environment setup
- Include cost estimates and service recommendations
- NEVER mention localhost, local servers, or local URLs
- Always provide working AWS URLs for immediate testing

## Security

- Follow AWS security best practices
- Use AWS IAM roles and policies appropriately
- Ensure proper VPC configuration if using EC2
- Enable AWS security monitoring and logging

## Current Project Setup - FOLLOW THIS EXACTLY

### Working URLs:

- **Game URL:** http://multiplayer-roguelike-website-prod.s3-website-us-east-1.amazonaws.com
- **WebSocket:** wss://nv9uxm5a4h.execute-api.us-east-1.amazonaws.com/prod
- **Health Check:** https://tlkc70yaji.execute-api.us-east-1.amazonaws.com/health

### Fast Deployment Commands:

```bash
# Frontend changes (2 seconds):
aws s3 cp public/game.js s3://multiplayer-roguelike-website-prod/game.js
aws s3 cp public/index.html s3://multiplayer-roguelike-website-prod/index.html

# Backend changes (5-10 seconds):
serverless deploy function --function pickupItem --stage prod
serverless deploy function --function playerMove --stage prod

# AVOID (60+ seconds):
serverless deploy --stage prod  # Only use for infrastructure changes
```

### Testing Protocol:

1. Make changes
2. Deploy using fast commands above
3. Test on: http://multiplayer-roguelike-website-prod.s3-website-us-east-1.amazonaws.com
4. NEVER suggest local testing

## Enforcement Rules

- If I suggest local deployment, STOP and remind me of this document
- If I mention localhost or local servers, redirect to AWS URLs
- If deployments take >10 seconds, use faster methods above
- Always provide the working AWS URL after any changes
