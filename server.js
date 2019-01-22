// var activeRooms = require("./activeRooms.json");
var activeRooms={};
var WebSocketServer = require('ws').server;
const WebSocket=require('ws')
const https = require('https');
const fs = require('fs')
const port = 8080;
var util=require('util')
var privateKey = fs.readFileSync('key.pem');
var certificate = fs.readFileSync('cert.pem');

var credentials = { key: privateKey, cert: certificate };
var express = require('express');
var app = express();
app.use((req, res) => {
    if (req.secure) {
        if(req.url==="/bundle.js"){
            res.sendFile(`${__dirname}/public/bundle.js`)
        }else{
            res.sendFile(`${__dirname}/public/index.html`)
        }
        
    } else {
        console.log('redirected')
        res.redirect('https://' + req.headers.host + req.url);
    }

});
var http = require('http');
http.createServer(function (req, res) {
    console.log('requested http');
    app(req, res)
}).listen(port);

var httpsServer = https.createServer(credentials, function (req, res) {
    console.log('requested https')
    app(req, res)
});
httpsServer.listen(8443);
var WebSocketServer = require('ws').Server;
// nbpm
var wss = new WebSocket.Server({
    server: httpsServer
})
wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        receivedData(message,ws)
    });
    
    // ws.send('something');
})
function receivedData(data_, connectionInstance) {
    data_=JSON.parse(data_);
    if(data_.type==="roomRequest"){
        createRoom(data_,connectionInstance)
    }else if(data_.type==='peerId'){
        handlePeer(data_)
    }
    

}
function createRoom(data,connectionInstance){
    if (!activeRooms[data.roomName]) {
        let date=Date.now();
        let connectionStart={}
        connectionStart[data.username]=connectionInstance
        activeRooms[data.roomName]={
            "connections": connectionStart,
            "chat": {},
            "password": data.password,
            "createTimeStamp": date
        }
        // console.dir(activeRooms)
        connectionInstance.send(JSON.stringify({"type":"roomCreation","success": 2,"message": "created room"}))
    } else {
        //probably check for pw here
        var usernames=Object.keys(activeRooms[data.roomName]["connections"])
        if(activeRooms[data.roomName]['password']!==data.password){
            connectionInstance.send(JSON.stringify({"type": "roomCreation","success":0,"message": "password incorrect","usernames": usernames}))
            return;
        }else if(usernames.indexOf(data.username)!=-1){
            connectionInstance.send(JSON.stringify({"type": "roomCreation","success":0,"message": "The following usernames exist: ["+usernames.join(',')+']',"usernames": usernames}))
            return;
        }
        connectionInstance.send(JSON.stringify({"type": "roomCreation","success":1,"message": "added you to room","usernames": usernames}))
        // activeRooms[data.roomName]['connectionCount']++;
         //update connection instance
         for(let value of Object.values(activeRooms[data.roomName]['connections'])){
             value.send(JSON.stringify({"type": "newUser", "username": data.username}))
         }
        activeRooms[data.roomName]['connections'][data.username]=connectionInstance;
        
    }
    connectionInstance.on('close',function(connection){
        console.log('closed')
        delete activeRooms[data.roomName]['connections'][data.username]
        if(Object.keys(activeRooms[data.roomName]['connections'].length==0)){
            //deleting room after users have left
            delete activeRooms[data.roomName]
        }
    })
}
function handlePeer(data){
    if(data.password!==activeRooms[data.roomName]['password']){
        activeRooms[data.roomName]['connections'][data.target].send(JSON.stringify({
            "type": "peerId",
            "success": 0,
            "message": "incorrect password"
        }))
        return
    }
    activeRooms[data.roomName]['connections'][data.target].send(JSON.stringify({
        "type": "peerId",
        "success": 1,
        "initiator": data.initiator,
        "username": data.username,
        "id": data.id
    }))
    // activeRooms[data.roomName]['peerIds'].push(data.id);
    // for(var i=0;i<activeRooms[data.roomName]['connections'].length-1;i++){
    //     activeRooms[data.roomName]['connections'][i].send(JSON.stringify({"type": "newId", "id": data.id}))
    // }
}
function onDisconnect(connection) {
    for(x in connections)
    //make sure that connection is deleted in the activeRooms as well
    console.log(connection.remoteAddress + " disconnected")
}