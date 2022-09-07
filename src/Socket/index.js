const {
  findOpenQueue,
  findTicketWithPlayerId,
  createTicket,
  cancelTicket,
} = require("../live-servers/lobby");
const {
  findGame,
  updateGameboard,
  startGame,
  requestRematch,
  resetGame,
  removeGame,
} = require("../live-servers/game");
const {
  emitMessage,
  emitGameData,
  emitGameResults,
  emitRematchMessage,
  emitResetGame,
  emitTicketData,
  emitMessageLeft,
} = require("../live-servers/socketEmit.js");
const { startLobbyTimer, clearLobbyTimer } = require("./timer");

const initialConnection = (socket, playerId) => {
  if (playerId) {
    socket.join(playerId);
    console.log(`connection made on socket id : ${playerId}`);
    const { ticket } = findTicketWithPlayerId(playerId);
    if (ticket?.createdBy?.uid) {
      emitTicketData(socket, ticket);
      emitMessage(socket, ticket.createdBy, "Already in the queue");
      // check if player is already in a game
      const { game } = findGame(playerId);
      if (game.lobbyId) {
        // send player to game
        socket.join(game.lobbyId);
        emitGameData(socket, game);
      }
    }
  }
};

const socketManager = (socket) => {
  const playerId = socket.handshake.query.id;
  initialConnection(socket, playerId);

  socket.on("cancel-ticket", ({ ticket, player, clock }) => {
    cancelTicket(ticket);
    clearLobbyTimer(socket, clock);
    emitTicketData(socket, {});
    emitMessage(socket, player, "canceled the search");
  });
  socket.on("new-game", ({ player, gameName, clock }) => {
    // search for an open queue
    const { openTicket } = findOpenQueue(player, gameName);
    if (!openTicket) {
      // add player to queue
      const { ticket } = createTicket(player, gameName);
      if (ticket.lobbyId) {
        socket.join(ticket.lobbyId);
        startLobbyTimer(socket, 0, clock);
        emitTicketData(socket, ticket);
        emitMessage(socket, player, "joined the queue");
      } else emitMessage(socket, player, "servers are down, try agian later");
    }
    if (openTicket) {
      socket.join(openTicket.lobbyId);
      // notify both players
      const msg = "Opponent found, starting match!";
      clearLobbyTimer(socket, clock);
      emitMessage(socket, player, msg, openTicket.lobbyId);
      // send both players the game data
      const { game } = startGame(openTicket, player);
      emitGameData(socket, game);
      // delete ticket
      cancelTicket(openTicket);
    }
  });

  socket.on("player-leave", ({ player, game }) => {
    // reset game results
    emitGameResults(socket, game.lobbyId, "");
    socket.leave(game.lobbyId);
    // delete game
    removeGame(game);
    emitMessageLeft(socket, game, player);
  });

  socket.on("place-mark", ({ game, cell, player }) => {
    // updated the game board
    const { updatedGame, result } = updateGameboard(game, cell, player);
    emitGameData(socket, updatedGame);
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
};

module.exports = { socketManager };
