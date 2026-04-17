import { Room } from "./room";
import { randomUUID } from 'crypto';

const rooms = new Map();

export function createroom(){
    const room = new Room(crypto.randomUUID);
    rooms.set(room.id, room);
    return room;
}

export function getRoom(id){
    return rooms.get(id)
}