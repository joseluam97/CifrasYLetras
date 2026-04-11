export const GameState = Object.freeze({
  CREATED: 'CREATED',
  PLAYING: 'PLAYING',
  RESULT: 'RESULT',
  END: 'END'
});

export const GameType = Object.freeze({
  LETRAS: 'LETRAS',
  CIFRAS: 'CIFRAS'
});

export const AppRole = Object.freeze({
  ADMIN: 'ADMIN',
  TV: 'TV',
  PLAYER: 'PLAYER'
});

export const RoomState = Object.freeze({
  CREATED: 'CREATED',
  COMPLETE: 'COMPLETE',
  PLAYING: 'PLAYING',
  FINISHED: 'FINISHED'
});