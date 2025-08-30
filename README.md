# RuleRogue

A web-based multiplayer roguelike game inspired by NetHack, built with Node.js and WebSockets. Designed for AWS deployment to enable seamless multiplayer gaming with friends and family.

## Features

- **🎮 Real-time multiplayer gameplay** - Classic roguelike multiplayer experience
- **� ASCII-style graphics** - Traditional roguelike aesthetic with colored characters
- **⌨️ Responsive controls** - WASD/Arrow key movement with anti-spam protection
- **👥 Player stats and positioning** - Track multiple players in real-time
- **🏰 Procedural dungeon generation** - Multi-level dungeons with stairs
- **⚔️ Combat system** - Fight monsters and collect loot
- **🎒 Inventory system** - Collect weapons, armor, potions, and gold
- **🎭 Character classes** - Choose from Fighter, Wizard, Rogue, or Cleric
- **☁️ AWS-optimized deployment** - Serverless architecture for global scale
- **🔌 WebSocket support** - Reliable real-time connections
- **📊 Health monitoring and auto-scaling** - Enterprise-grade reliability

## Serverless AWS Deployment (Ultra Low Cost!)

This game uses a **100% serverless architecture** for maximum cost efficiency:

- **AWS Lambda** - Pay only when players are active
- **API Gateway WebSockets** - Real-time multiplayer
- **DynamoDB** - NoSQL database with pay-per-request
- **S3** - Static website hosting
- **CloudWatch** - Monitoring and logs

### Prerequisites

- AWS CLI installed and configured
- Node.js 18+ installed
- AWS account with appropriate permissions

### Quick Deploy

1. Clone this repository
2. Run the deployment script:

   ```bash
   # On Windows
   deploy-serverless.bat
   ```

3. Your game will be live at the S3 website URL!

### Manual Serverless Deployment

1. Install dependencies:

   ```bash
   npm install
   ```

2. Deploy infrastructure:

   ```bash
   npx serverless deploy
   ```

3. Deploy website:
   ```bash
   npm run deploy:website
   ```

## Local Development (Testing Only)

For local testing with serverless-offline:

```bash
npm install
npm run offline
```

## Controls

- **WASD** or **Arrow Keys**: Move your character one tile at a time
- **Movement**: Classic roguelike movement with 100ms cooldown to prevent spam
- **Combat**: Walk into monsters to attack them
- **Items**: Walk over items to pick them up automatically
- **Stairs**: Stand on stairs (`<` or `>`) and press any direction to use them
- **H**: Help (in-game guide with full controls)
- **I**: Inventory (view collected items)

### 🎮 Gameplay Features

- **Server Authoritative**: All game logic runs on the server for fair play
- **Real-time Updates**: See other players move and act instantly
- **Anti-spam Protection**: Movement cooldown prevents accidental rapid movement
- **Reliable Networking**: No rubberbanding or desync issues
- **Classic Feel**: Traditional roguelike movement and mechanics

### 🎮 Game Features

- **Rich Loot System**: Monsters drop weapons, armor, potions, and gold
- **Character Classes**: Fighter, Wizard, Rogue, Cleric with unique colors and symbols
- **Visual Distinction**: Players glow and stand out from monsters
- **Comprehensive Help**: Press 'H' in-game for full controls and guide
- **Smart Inventory**: Color-coded items by rarity with stat display
- **Equipment Stats**: Weapons show damage, armor shows defense
- **Gold Economy**: Collect gold from defeated monsters

## Planned Features

- [x] Combat system ✅
- [x] Inventory and items ✅
- [x] Multiple dungeon levels ✅
- [x] Character classes ✅
- [ ] Equipment system (equip/unequip items)
- [ ] Spells and abilities
- [ ] Advanced monster AI
- [ ] More procedural dungeon generation
- [ ] Chat system
- [ ] Save/load game state
- [ ] Experience and leveling system

## Serverless Cost Estimation (Pay Only for Usage!)

**AWS Lambda:**

- 1M requests/month: FREE (AWS Free Tier)
- Additional requests: $0.20 per 1M requests
- Compute time: $0.0000166667 per GB-second

**API Gateway WebSockets:**

- 1M messages/month: $1.00
- Connection minutes: $0.25 per million

**DynamoDB:**

- 25GB storage: FREE (AWS Free Tier)
- Pay-per-request: $1.25 per million requests

**S3 Website Hosting:**

- 5GB storage: FREE (AWS Free Tier)
- Data transfer: $0.09 per GB

**Estimated Monthly Cost:**

- **Light usage (few players, occasional games): $0-2/month**
- **Moderate usage (regular gaming sessions): $2-8/month**
- **Heavy usage (many players, daily games): $8-15/month**

**🎉 Up to 95% cheaper than traditional server hosting!**

## Technical Details

- **Backend**: AWS Lambda + API Gateway WebSockets + DynamoDB
- **Frontend**: HTML5 + Vanilla JavaScript
- **Real-time Communication**: WebSockets via API Gateway
- **Game State**: Stored in DynamoDB with TTL auto-cleanup
- **Architecture**: 100% serverless, pay-per-use

## Playing with Friends

Once deployed to AWS:

1. Share your AWS application URL with your brothers
2. Everyone enters their name and joins the same game instance
3. Play together in real-time from anywhere in the world!

## Serverless Security Features

- **HTTPS by default** via API Gateway
- **IAM roles and policies** for least-privilege access
- **DynamoDB encryption** at rest and in transit
- **CloudWatch monitoring** and alerting
- **Automatic scaling** based on demand
- **TTL cleanup** prevents data accumulation

## Monitoring

- Health endpoint: `GET /health`
- CloudWatch logs for all Lambda functions
- DynamoDB metrics and alarms
- Real-time connection and game monitoring
- Automatic cleanup of inactive games every 5 minutes

## Serverless Benefits

- **Zero server management** - AWS handles everything
- **Automatic scaling** - from 0 to thousands of players
- **High availability** - Multi-AZ by default
- **Pay per use** - No idle server costs
- **Global edge locations** - Low latency worldwide
