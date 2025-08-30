const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static("public"));

// Game state
const gameState = {
  players: new Map(),
  dungeon: null,
  gameStarted: false,
};

// Socket connection handling
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("joinGame", (playerData) => {
    // Add player to game
    gameState.players.set(socket.id, {
      id: socket.id,
      name: playerData.name || `Player${gameState.players.size + 1}`,
      x: 1,
      y: 1,
      hp: 100,
      maxHp: 100,
      level: 1,
      inventory: [],
      symbol: "@",
    });

    // Initialize dungeon if first player
    if (!gameState.dungeon) {
      gameState.dungeon = generateDungeon(20, 20);
    }

    // Send game state to all players
    io.emit("gameState", {
      players: Array.from(gameState.players.values()),
      dungeon: gameState.dungeon,
    });

    console.log(`${playerData.name} joined the game`);
  });

  socket.on("playerMove", (direction) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    const newPos = getNewPosition(player.x, player.y, direction);

    // Check if move is valid
    if (isValidMove(newPos.x, newPos.y, gameState.dungeon)) {
      player.x = newPos.x;
      player.y = newPos.y;

      // Broadcast updated game state
      io.emit("gameState", {
        players: Array.from(gameState.players.values()),
        dungeon: gameState.dungeon,
      });
    }
  });

  socket.on("disconnect", () => {
    gameState.players.delete(socket.id);
    io.emit("gameState", {
      players: Array.from(gameState.players.values()),
      dungeon: gameState.dungeon,
    });
    console.log("Player disconnected:", socket.id);
  });
});

// Helper functions
function generateDungeon(width, height) {
  const dungeon = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      // Simple room generation - walls on edges, floor inside
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push("#"); // Wall
      } else {
        row.push("."); // Floor
      }
    }
    dungeon.push(row);
  }
  return dungeon;
}

function getNewPosition(x, y, direction) {
  switch (direction) {
    case "up":
      return { x, y: y - 1 };
    case "down":
      return { x, y: y + 1 };
    case "left":
      return { x: x - 1, y };
    case "right":
      return { x: x + 1, y };
    default:
      return { x, y };
  }
}

function isValidMove(x, y, dungeon) {
  if (y < 0 || y >= dungeon.length || x < 0 || x >= dungeon[0].length) {
    return false;
  }
  return dungeon[y][x] !== "#";
}

// Health check endpoint for AWS load balancers
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    players: gameState.players.size,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Roguelike server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
