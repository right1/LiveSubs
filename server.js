var activeRooms = {};
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
    ws.on('close',function(connection){
        onDisconnect(connection);
    })
    // ws.send('something');
})
function receivedData(data_, connectionInstance) {
    data_=JSON.parse(data_);
    if(data_.type==="roomRequest"){
        createRoom(data_,connectionInstance)
    }else if(data_.type==='addId'){
        addId(data_)
    }
    

}
function createRoom(data,connectionInstance){
    if (!activeRooms[data.roomName]) {
        let date=Date.now();
        activeRooms[data.roomName]={
            "connections": [connectionInstance],
            "chat": {},
            "password": "",
            "peerIds":[],
            "createTimeStamp": date,
            "connections": [connectionInstance]
        }
        connectionInstance.send(JSON.stringify({"type":"roomCreation","success": 2,"message": "created room", "peerIds": []}))
    } else {
        //probably check for pw here
        connectionInstance.send(JSON.stringify({"type": "roomCreation","success":1,"message": "added you to room",
         "peerIds": activeRooms[data.roomName]['peerIds']}))
        
         //send user id to all other connection instances in room here
        activeRooms[data.roomName]['connections'].push(connectionInstance);
        
    }
}
function addId(data){
    activeRooms[data.roomName]['peerIds'].push(data.id);
    for(var i=0;i<activeRooms[data.roomName]['connections'].length-1;i++){
        activeRooms[data.roomName]['connections'][i].send(JSON.stringify({"type": "newId", "id": data.id}))
    }
}
function onDisconnect(connection) {
    //make sure that connection is deleted in the activeRooms as well
    console.log(connection.remoteAddress + "disconnected")
}