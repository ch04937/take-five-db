require("dotenv").config();
const express = require("express");
const { Server } = require("socket.io");
const { createServer } = require("http");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const userRouter = require("./routes/user-router.js");
const {
  removePlayer,
  findOpenQueue,
  createTicket,
  startGame,
} = require("./live-servers/lobby");
const {
  findGame,
  updateGameboard,
  requestRematch,
  resetGame,
} = require("./live-servers/game");
const {
  emitMessage,
  emitGameData,
  emitGameStart,
  emitGameResults,
  emitRematchMessage,
  emitResetGame,
} = require("./live-servers/socketEmit.js");

// CONNECT TO MONGOOSEDB
const uri = `mongodb+srv://${process.env.MONGOOSE_USERNAME}:${process.env.MONGOOSE_PASSWORD}@cluster0.9er2n.mongodb.net/take-five-db?retryWrites=true&w=majority`;

const port = process.env.PORT || 4937;
const server = express();
const httpServer = createServer(server);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONT_END_BASE_URL,
    methods: ["GET", "POST"],
  },
});
server.use(helmet());
server.use(cookieParser());
server.use(
  cors({
    credentials: true,
    origin: process.env.FRONT_END_BASE_URL,
  })
);
server.use(express.json());
server.use("/users/", userRouter);

// initialize socket for the server
// TODO: MOVE TO AN EMPTY DIRECTORY
io.on("connection", (socket) => {
  const playerId = socket.handshake.query.id;
  if (playerId) {
    socket.join(playerId);
    console.log(`connection made on socket id : ${playerId}`);
  }
  // check if player is already in a game
  const { result } = findGame(playerId);
  if (result.lobbyId) {
    // send player to game
    socket.join(result.lobbyId);
    emitGameStart(socket, result);
  }
  socket.on("new-game", ({ player, game }) => {
    // search for an open queue
    const { openTicket } = findOpenQueue(game);
    if (!openTicket) {
      // add player to queue
      const { ticket } = createTicket(player, game);
      if (ticket.lobbyId) {
        socket.join(ticket.lobbyId);
        emitMessage(socket, player, "joined the queue");
      } else emitMessage(socket, player, "servers are down, try agian later");
    }
    if (openTicket) {
      // notify both players
      socket.join(openTicket.lobbyId);
      const msg = "Opponent found, starting match!";
      emitMessage(socket, player, msg, openTicket.lobbyId);
      // send both players the game data
      const { game } = startGame(openTicket, player);
      emitGameStart(socket, game);
    }
  });
  // TODO: EMIT GAMESTART AND GAMEDATA ARE THE SAME FUNCTION
  socket.on("leave", ({ player, lobbyId }) => {
    console.log("leave");
    const { removed, game } = removePlayer(player, lobbyId);
    if (removed) {
      io.to(lobbyId).emit("message", {
        player,
        message: `${player.nickname} has left`,
      });
      io.to(lobbyId).emit("gameData", { game, lobby });
    }
  });
  socket.on("place-mark", ({ game, cell, player }) => {
    // updated the game board
    const { updatedGame, result } = updateGameboard(game, cell, player);
    emitGameData(socket, updatedGame, game.lobbyId);
    // check for win
    if (result === "win" || result === "draw") {
      emitGameResults(socket, game.lobbyId, result);
    }
  });
  socket.on("request-rematch", ({ game, isPlayer1 }) => {
    const { players } = requestRematch(game, isPlayer1);
    if (players.player2.rematch && players.player1.rematch) {
      const { reset } = resetGame(game);
      // send reset game to both player
      emitResetGame(socket, reset);
    } else {
      emitRematchMessage(socket, game, players, isPlayer1);
    }
  });
});
// tesing server
server.get("/", (req, res) => {
  res.status(200).json({ message: "api is running" });
});
mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    server.listen(port, () => {
      console.log(`\n *** Server listening on port ${port} *** \n`);
    });
    httpServer.listen(1200, () => console.log("1200"));
  })
  .catch((e) => console.log("e", e));
