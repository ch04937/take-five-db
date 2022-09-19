const checkVictory = (board, player, count) => {
  let scoreBoard = { x1: 0, x2: 0, x3: 0, y1: 0, y2: 0, y3: 0, z1: 0, z2: 0 };
  if (count > 8) return { result: "Draw!" };
  // update the scoreboard
  for (let i = 0; i < board.length; i++) {
    const cell = board[i];
    if (cell.content === player.uid) {
      // log each row
      scoreBoard[`x${cell.x}`] += 1;
      scoreBoard[`y${cell.y}`] += 1;
      // log diagnols
      if (cell.x === 1 && cell.y === 1) scoreBoard.z1 += 1;
      if (cell.x === 2 && cell.y === 2) scoreBoard.z1 += 1;
      if (cell.x === 3 && cell.y === 3) scoreBoard.z1 += 1;
      if (cell.x === 1 && cell.y === 3) scoreBoard.z2 += 1;
      if (cell.x === 2 && cell.y === 2) scoreBoard.z2 += 1;
      if (cell.x === 3 && cell.y === 1) scoreBoard.z2 += 1;
    }
  }
  if (Object.values(scoreBoard).includes(3)) {
    return { result: "Victory!" };
  }
  return { result: "continue" };
};
module.exports = { checkVictory };
