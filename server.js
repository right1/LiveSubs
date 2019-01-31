var activeRooms = {};
const languages = require("./languages.json")['languages'];
//var WebSocketServer = require('ws').server;
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const express = require('express');
const fs = require('fs');
const httpPort = process.env.PORT || 80;
const httpsPort = 443;
const FAILED = 0;
const JOINED = 1;
const CREATED = 2;

let privateKey = fs.readFileSync('credentials_testing/key.pem');
let certificate = fs.readFileSync('credentials_testing/cert.pem');
var credentials = { key: privateKey, cert: certificate };

const app = express();

// Set 'public' folder as root
app.use(express.static('public'));
// Provide access to node_modules folder from the client-side
app.use('/scripts', express.static(`${__dirname}/node_modules/`));

// Send website files and redirect.
app.use((req, res) => {
    if (req.secure) {
        if (req.url === "/") {
            // Send webpage index HTML
            res.sendFile(`${__dirname}/public/index.html`);
        }
        else if (req.url === "/favicon.ico") {
            // Send favicon
            res.sendFile(`${__dirname}/public/favicon.ico`);
        }
        else {
            // Automatically send JS and CSS files in public folder.
            if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
                let fullPath = `${__dirname}/public` + req.url;
                // console.log('sent ' + fullPath);
                res.sendFile(fullPath);
            }
            else {
                // Print any files that weren't sent.
                console.log(req.url + ' was not sent');
            }
        }
    }
    else {
        res.redirect()
        console.log('Client made a insecure request for: ' + req.url);
    }
});

// Heroku works with this and handles HTTPS redirection.
var httpServer = http.createServer(function (req, res) {
    app(req, res);
});
httpServer.listen(httpPort);

// Only useful when self-hosting, or using something other than Heroku.
var httpsServer = https.createServer(credentials, function (req, res) {
    app(req, res);
});
// httpsServer.listen(httpsPort);

// Setup WebSocket server
var wss = new WebSocket.Server({
    server: httpServer
});
wss.on('connection', function connection(ws) {
    // Callback for client requests
    ws.on('message', function incoming(message) {
        receivedData(message, ws);
    });
});

function receivedData(data, connectionInstance) {
    if (data.length > 0) {
        // Received an actual request from client.
        data = JSON.parse(data);

        if (data.type === 'createRoom') {
            createRoom(data, connectionInstance);
        }
        else if (data.type === 'joinRoom') {
            joinRoom(data, connectionInstance);
        }
        else if (data.type === 'peerId') {
            handlePeer(data);
        }
    }
}

function createRoom(data, connectionInstance) {
    if (!activeRooms[data.roomName]) {
        let date = Date.now();
        let connectionStart = {}
        connectionStart[data.username] = connectionInstance;

        activeRooms[data.roomName] = {
            "connections": connectionStart,
            //"chat": [],
            "password": data.password,
            "createTimeStamp": date,
            "languages": data.languages
        }

        connectionInstance.send(JSON.stringify({
            "type": "roomCreation",
            "success": CREATED,
            "message": "created room",
            "roomName": data.roomName
        }));

        console.log(data.username + ' created room ' + data.roomName);
    } else {
        connectionInstance.send(JSON.stringify({
            "type": "roomCreation",
            "success": FAILED,
            "message": "Room already exists."
        }));
        return;
    }

    connectionInstance.on('close', function (connection) {
        onClose(connection, data);
    })
}
function joinRoom(data, connectionInstance) {

    if (!activeRooms[data.roomName]) {
        connectionInstance.send(JSON.stringify({
            "type": "roomCreation",
            "success": FAILED,
            "message": "Room doesn't exist!"
        }));
        return;
    }
    var usernames = Object.keys(activeRooms[data.roomName]["connections"]);
    const roomLanguages = activeRooms[data.roomName]['languages'];
    if (activeRooms[data.roomName]['password'] !== data.password) {
        connectionInstance.send(JSON.stringify({
            "type": "roomCreation",
            "success": FAILED,
            "message": "Incorrect password!"
        }));
        return;
    }
    else if (usernames.indexOf(data.username) != -1) {
        // Send the usernames of people in room.
        connectionInstance.send(JSON.stringify({
            "type": "roomCreation",
            "success": FAILED,
            "message": "The following usernames exist: [" + usernames.join(',') + ']',
            "usernames": usernames
        }));
        return;
    } else if (roomLanguages[0] !== data.language && roomLanguages[1] !== data.language) {
        connectionInstance.send(JSON.stringify({
            "type": "roomCreation",
            "success": FAILED,
            "message": "This room only supports " + languages[roomLanguages[0]]['displayName'] + " and " + languages[roomLanguages[1]]['displayName'] + "."
        }));
        return;
    }

    // Inform client of which language to translate to. If the translation is not applicable, it will be -1.
    let otherLanguage = -1;

    for (let i = 0; i < roomLanguages.length; i++) {
        if (roomLanguages[i] != data.language) {
            otherLanguage = roomLanguages[i];
            break;
        }
    }

    connectionInstance.send(JSON.stringify({
        "type": "roomCreation",
        "roomName": data.roomName,
        "success": JOINED,
        "message": "added you to room",
        "usernames": usernames,
        "translateTo": otherLanguage
        //,"chat": activeRooms[data.roomName]['chat']
    }));

    // activeRooms[data.roomName]['connectionCount']++;
    //update connection instance
    for (let value of Object.values(activeRooms[data.roomName]['connections'])) {
        value.send(JSON.stringify({
            "type": "newUser",
            "username": data.username
        }));
    }
    activeRooms[data.roomName]['connections'][data.username] = connectionInstance;
    console.log(data.username + ' joined ' + data.roomName);
    connectionInstance.on('close', function (connection) {
        onClose(connection, data);
    })

}
function onClose(connection, data) {
    delete activeRooms[data.roomName]['connections'][data.username];

    if (Object.keys(activeRooms[data.roomName]['connections']).length == 0) {
        //deleting room after users have left
        delete activeRooms[data.roomName];
        console.log('Deleted room ' + data.roomName);
    }
}
function handlePeer(data) {
    // Send response back to client.
    if (data.password !== activeRooms[data.roomName]['password']) {
        activeRooms[data.roomName]['connections'][data.target].send(JSON.stringify({
            "type": "peerId",
            "success": FAILED,
            "message": "Incorrect password"
        }));
    }
    else {
        activeRooms[data.roomName]['connections'][data.target].send(JSON.stringify({
            "type": "peerId",
            "success": JOINED,
            "initiator": data.initiator,
            "username": data.username,
            "id": data.id
        }));
    }
}

function onDisconnect(connection) {
    for (x in connections) {
        //make sure that connection is deleted in the activeRooms as well
        console.log(connection.remoteAddress + " disconnected");
    }
}