export type RoomPlayer = {
    userId: string;
    nickname: string;
    isReady: boolean;
    joinedAt: number;
    connectStatus?: 'connected' | 'disconnected' | 'offline'; // for future use
    socketId?: string //for socket 
}

export type RoomStatus = "waiting" | "active" | "closed" | "starting";
export type Room = {
    roomId: string;
    hostId: string;
    players: Record<string, RoomPlayer>;
    status:  RoomStatus;
    createdAt: number;
    maxPlayers: number;
    sessionId?: string; // gameid or userid for friends chat
    tournamentId?: string; // link this room to a tournament bracket match
    AIplayerIds?: string[];
}

export type CreateRoomParams = {
    hostId: string;
    hostNickname: string;
    players?: { userId: string; nickname: string }[];
    maxPlayers?: number;
    type?: 'game'| 'chat';
    tournamentId?: string;
    AIplayerIds?: string[];
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