export type RoomPlayer = {
    id: string;
    nickname: string;
    isReady: boolean;
    joinedAt: number;
    socketId?: string //for socket 
}

export type Room = {
    roomId: string;
    hostId: string;
    players: Record<string, RoomPlayer>;
    status: 'waiting' | 'starting' | 'in_game' | 'finished';
    createdAt: number;
    maxPlayers: number;
    gameId?: string; //to save in gamestate 
}


export type CreateRoomParams = {
    hostId: string;
    hostNickname: string;
    players?: { userId: string; nickname: string }[];
}

export type JoinRoomParams = {
    roomId: string;
    playerId: string;
    playerNickname: string; 
}

export type RoomEntryParams = {
    userId: string;
    nickname: string;
    mode: string;
    targetId?: string; // roomid or userid for chat
}
export type RoomEntryResult = { status: 'joined', room: Room} | null 
export interface IRoomEntryStrategy{
    entry(params: RoomEntryParams): Promise<RoomEntryResult>
}