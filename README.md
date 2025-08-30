# 🎮 RuleRogue - Multiplayer Roguelike Game

A real-time multiplayer roguelike game built with React and AWS serverless architecture. Explore procedurally generated dungeons, fight monsters, collect loot, and play with friends!

## 🚀 Live Demo

**Play Now:** http://multiplayer-roguelike-website-prod.s3-website-us-east-1.amazonaws.com

## ✨ Features

### 🎯 Core Gameplay

- **NetHack-Style Roguelike** - Authentic turn-based gameplay with fog of war
- **Monster AI** - Monsters actively hunt and attack players (no more passive enemies!)
- **Fog of War** - Line of sight system - only see what's within 8 tiles
- **Real-time multiplayer** - See other players move instantly
- **4 Character Classes** - Fighter, Wizard, Rogue, Cleric with unique abilities
- **Procedurally Generated Dungeons** - Every level is unique
- **Turn-Based Combat** - Each move triggers monster turns for strategic gameplay
- **Loot System** - Weapons, armor, potions, and gold with rarity levels
- **Multi-level Exploration** - Use stairs to go deeper for better rewards

### 👥 Multiplayer Features

- **Room Codes** - Create or join specific game rooms
- **Player Identification** - Unique colors and symbols for each class
- **Cooperative Gameplay** - Work together to explore dungeons
- **Real-time Updates** - Instant synchronization across all players

### 🎨 User Experience

- **NetHack-inspired ASCII Graphics** - Classic roguelike aesthetic
- **Responsive Controls** - Smooth WASD/Arrow key movement
- **Inventory Management** - Collect and equip items
- **Help System** - In-game guide with full controls
- **Auto-save Preferences** - Remember your character settings

## 🎮 How to Play

### Controls

- **WASD/Arrow Keys** - Move your character
- **I** - Open inventory
- **E** - Equipment menu (equip weapons/armor)
- **,** (comma) - Pick up items at your location
- **>** - Go down stairs | **<** - Go up stairs
- **H** - Show help menu
- **ESC** - Close menus

### Getting Started

1. Visit the game URL
2. Enter your character name
3. Choose a class (Fighter, Wizard, Rogue, or Cleric)
4. Create a new room or enter a room code to join friends
5. Start exploring and fighting monsters!

### Character Classes

- **🗡️ Fighter (@)** - High HP, strong melee combat
- **🔮 Wizard (\*)** - Magic abilities, lower HP but powerful
- **🗡️ Rogue (&)** - Agile and stealthy, balanced stats
- **⚕️ Cleric (+)** - Healing abilities, well-rounded

## 🛠️ Tech Stack

### Frontend

- **React 18** - Modern UI framework
- **Vite** - Fast build tool and dev server
- **WebSocket API** - Real-time communication
- **CSS3** - NetHack-inspired styling

### Backend (AWS Serverless)

- **AWS Lambda** - Serverless compute for game logic
- **API Gateway WebSocket** - Real-time multiplayer communication
- **DynamoDB** - NoSQL database for game state
- **S3 Static Hosting** - Frontend deployment
- **Serverless Framework** - Infrastructure as Code

### Architecture Benefits

- **Scalable** - Automatically handles any number of players
- **Cost-effective** - Pay only for what you use
- **Global** - Low latency worldwide with AWS edge locations
- **Reliable** - AWS managed services with 99.9% uptime

## 🚀 Development Setup

### Prerequisites

- Node.js 18+
- AWS CLI configured with appropriate permissions
- Serverless Framework (`npm install -g serverless`)

### Installation

```bash
# Clone the repository
git clone https://github.com/macaw2000/RuleRogue.git
cd RuleRogue

# Install dependencies
npm install

# Deploy backend to AWS
serverless deploy --stage prod

# Build frontend
npm run build

# Deploy frontend to S3
npm run deploy
```

### Local Development

```bash
# Start local development server
npm run dev

# Run backend locally (optional)
serverless offline
```

## 📁 Project Structure

```
RuleRogue/
├── src/                    # Backend Lambda functions
│   ├── websocket/         # WebSocket handlers
│   ├── http/              # HTTP API handlers
│   └── scheduled/         # Cleanup functions
├── public/                # Frontend static files
│   ├── index.html        # Main HTML file
│   └── game.js           # Game client code
├── serverless.yml        # AWS infrastructure config
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## 🔧 Deployment

### Fast Deployment (Recommended)

```bash
# Frontend changes (2 seconds)
aws s3 cp public/game.js s3://multiplayer-roguelike-website-prod/game.js

# Backend function updates (5-10 seconds)
serverless deploy function --function playerMove --stage prod

# Full deployment (60+ seconds, only for infrastructure changes)
serverless deploy --stage prod
```

### Environment Configuration

The game automatically configures for AWS deployment. Key endpoints:

- **WebSocket:** `wss://m7usyjkjgd.execute-api.us-east-1.amazonaws.com/prod`
- **Health Check:** `https://7nqypvcs16.execute-api.us-east-1.amazonaws.com/health`

## 🎯 Game Mechanics

### Combat System

- Walk into monsters to attack automatically
- Different monsters have varying HP and damage
- Equipment affects your combat effectiveness
- Gain experience and gold from victories

### Loot System

- **Weapons (/)** - Increase damage output
- **Armor ([)** - Reduce incoming damage
- **Potions (!)** - Healing and buffs
- **Rings (=)** - Special abilities
- **Rarity Levels** - Common (green), Uncommon (blue), Rare (purple)

### Dungeon Exploration

- Each level has unique layout and monsters
- Deeper levels have stronger enemies and better loot
- Use **<** and **>** stairs to navigate between levels
- Procedural generation ensures replayability

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎮 Credits

Inspired by classic roguelike games like NetHack, Rogue, and modern multiplayer implementations. Built with modern web technologies for accessibility and real-time multiplayer experience.

---

**Ready to explore the dungeons? [Start Playing Now!](http://multiplayer-roguelike-website-prod.s3-website-us-east-1.amazonaws.com)**
