import express from 'express'
import {createServer} from 'http'
import {WebSockerServer } from 'ws'

export class OnlineServer{
    private wss: WebSockerServer;
    
    constructor(){
        this.wss = new WebSockerServer({
            server
        });

        this.wss.on('connection', function connection(ws){
            console.log('new client connected');
        })

        this.wss.on('message', function message(data){
            const messagetest = data.toString(),
            console.log('received: ', messagetest),
            ws.send(`echo: ${messagetest}`)
        })

        this.wss.on('close', function close(){
            console.log("client disconnected")
        })
    }



}
/***
 * veriy and get the useid by httponly cookie 
 *  1. type of service: chat or game 
 *  2. init websocket, when a user connected, add the user in the set
 *      send message 
 *  3. event
 *  4. close 
 * 
 *  event: 
 *      1. 
 * 
 * 
 */