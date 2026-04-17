
export class Room{
    constructor(id){
        this.id = id;
        this.players = [];
        this.game = null;
        this.status = 'waiting'
    }

    addplayer(playerid){
        this.players.push(playerid)
    }

    startgame(game){
        this.game = game;
        this.status = 'playing'
    }
}


/****
 * room: 
 *      use for >= 2 players
 * 
 */