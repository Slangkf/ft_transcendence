export type RoomPlayer = {
    id: string;
    nickname: string;
    isReady: boolean;
    joinedAt: Date;

    socketId?: string //for socket 
}


export type Room = {
    roomId: string;
    hostId: string;
    players: Record<string, RoomPlayer>;
    minPlayers: number;
    maxPlayers: number;
    status: 'waiting' | 'starting' | 'in_game' | 'finished';
    createdAt: Date;
    gameId?: string; //to save in gamestate 
}

export type CreateRoomParams = {
    hostId: string;
    hostNickname: string;
    maxPlayers: number;
}

export type JoinRoomParams = {
    roomId: string;
    playerId: string;
    playerNickname: string; 
}