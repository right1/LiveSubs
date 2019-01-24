// var activeRooms = require("./activeRooms.json");
var activeRooms = {};
//var WebSocketServer = require('ws').server;
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const express = require('express');
const fs = require('fs');
const httpPort = 80;
const httpsPort = 443;
const FAILED = 0;
const JOINED = 1;
const CREATED = 2;

let privateKey = fs.readFileSync('credentials/key.pem');
let certificate = fs.readFileSync('credentials/cert.pem');
var credentials = { key: privateKey, cert: certificate };

var app = express();
app.use((req, res) => {
    if (req.secure) {
        if (req.url === "/bundle.js") {
            res.sendFile(`${__dirname}/public/bundle.js`);
        }else if(req.url==="/speech.js"){
            res.sendFile(`${__dirname}/public/speech.js`);
        }else if(req.url==="/main.css"){
            res.sendFile(`${__dirname}/public/main.css`);
        }
        else {
            res.sendFile(`${__dirname}/public/index.html`);
        }

    }
    else {
        console.log('redirected');
        res.redirect('https://' + req.headers.host + req.url);
    }
});

http.createServer(function (req, res) {
    console.log('requested http');
    app(req, res);
}).listen(httpPort);

var httpsServer = https.createServer(credentials, function (req, res) {
    //console.log('requested https')
    app(req, res);
});
httpsServer.listen(httpsPort);

// Setup WebSocket server
var wss = new WebSocket.Server({
    server: httpsServer
});
wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        receivedData(message, ws);
    });
});

function receivedData(data_, connectionInstance) {
    data_ = JSON.parse(data_);
    if (data_.type === "roomRequest") {
        createRoom(data_, connectionInstance);
    }
    else if (data_.type === 'peerId') {
        handlePeer(data_);
    }
}

function createRoom(data, connectionInstance) {
    if (!activeRooms[data.roomName]) {
        let date = Date.now();
        let connectionStart = {}
        connectionStart[data.username] = connectionInstance;
        activeRooms[data.roomName] = {
            "connections": connectionStart,
            "chat": {},
            "password": data.password,
            "createTimeStamp": date,
            "languages": data.languages
        }
        // console.dir(activeRooms)
        connectionInstance.send(JSON.stringify({
            "type": "roomCreation",
            "success": CREATED,
            "message": "created room",
            "roomName": data.roomName
        }));
        console.log('created ' + data.roomName);
    }
    else {
        var usernames = Object.keys(activeRooms[data.roomName]["connections"]);
        const roomLanguages=activeRooms[data.roomName]['languages']
        if (activeRooms[data.roomName]['password'] !== data.password) {
            connectionInstance.send(JSON.stringify({
                "type": "roomCreation",
                "success": FAILED,
                "message": "Password incorrect!"
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
        }else if(roomLanguages[0]!==data.language && roomLanguages[1]!==data.language){
            connectionInstance.send(JSON.stringify({
                "type": "roomCreation",
                "success": FAILED,
                "message": "This room only supports "+languages[roomLanguages[0]]['displayName']+" and "+languages[roomLanguages[1]]['displayName']+"."
            }));
            return;
        }
        let otherLanguage=-1;
        for(let i=0;i<roomLanguages.length;i++){
            if(roomLanguages[i]!=data.language){
                otherLanguage=roomLanguages[i]
            }
        }
        connectionInstance.send(JSON.stringify({ "type": "roomCreation", "roomName": data.roomName, "success": JOINED, "message": "added you to room", "usernames": usernames, "translateTo": otherLanguage }));
        // activeRooms[data.roomName]['connectionCount']++;
        //update connection instance
        for (let value of Object.values(activeRooms[data.roomName]['connections'])) {
            value.send(JSON.stringify({ "type": "newUser", "username": data.username }));
        }
        activeRooms[data.roomName]['connections'][data.username] = connectionInstance;
        console.log('user joined ' + data.roomName);
    }
    connectionInstance.on('close', function (connection) {
        delete activeRooms[data.roomName]['connections'][data.username];

        if (Object.keys(activeRooms[data.roomName]['connections']).length == 0) {
            //deleting room after users have left
            delete activeRooms[data.roomName];
            console.log('deleted room ' + data.roomName);
        }
    })
}

function handlePeer(data) {
    if (data.password !== activeRooms[data.roomName]['password']) {
        activeRooms[data.roomName]['connections'][data.target].send(JSON.stringify({
            "type": "peerId",
            "success": FAILED,
            "message": "Incorrect password"
        }));
        return;
    }

    activeRooms[data.roomName]['connections'][data.target].send(JSON.stringify({
        "type": "peerId",
        "success": JOINED,
        "initiator": data.initiator,
        "username": data.username,
        "id": data.id
    }));
    // activeRooms[data.roomName]['peerIds'].push(data.id);
    // for(var i=0;i<activeRooms[data.roomName]['connections'].length-1;i++){
    //     activeRooms[data.roomName]['connections'][i].send(JSON.stringify({"type": "newId", "id": data.id}))
    // }
}

function onDisconnect(connection) {
    for (x in connections) {
        //make sure that connection is deleted in the activeRooms as well
        console.log(connection.remoteAddress + " disconnected");
    }
}
const languages = [
    { // English
        displayName: "English",
        translateLangCode: "en",
        htmlLangCode: "en-US",
        maxSubtitleChars: 96
    },
    { // Afrikaans
        displayName: "Afrikaans",
        translateLangCode: "af",
        htmlLangCode: "af",
        maxSubtitleChars: 96
    },
    { // Arabic (Jordan)
        displayName: "العَرَبِيَّة",
        translateLangCode: "ar",
        htmlLangCode: "ar-JO",
        maxSubtitleChars: 60
    },
    { // Bulgarian
        displayName: "български",
        translateLangCode: "bg",
        htmlLangCode: "bg",
        maxSubtitleChars: 96
    },
    { // Chinese (Simplified)
        displayName: "中文 (简体)",
        translateLangCode: "zh-CN",
        htmlLangCode: "zh-CN",
        maxSubtitleChars: 48
    },
    { // Czech
        displayName: "Čeština",
        translateLangCode: "cs",
        htmlLangCode: "cs",
        maxSubtitleChars: 96
    },
    { // German
        displayName: "Deutsch",
        translateLangCode: "de",
        htmlLangCode: "de-DE",
        maxSubtitleChars: 96
    },
    { // Spanish
        displayName: "Español",
        translateLangCode: "es",
        htmlLangCode: "es-SP",
        maxSubtitleChars: 96
    },
    { // Finnish
        displayName: "Suomen Kieli",
        translateLangCode: "fi",
        htmlLangCode: "fi",
        maxSubtitleChars: 96
    },
    { // French
        displayName: "Français",
        translateLangCode: "fr",
        htmlLangCode: "fr-FR",
        maxSubtitleChars: 96
    },
    { // Japanese
        displayName: "日本語",
        translateLangCode: "ja",
        htmlLangCode: "ja-JP",
        maxSubtitleChars: 48
    },
    { // Korean
        displayName: "한국어",
        translateLangCode: "ko",
        htmlLangCode: "ko",
        maxSubtitleChars: 48
    },
    { // Dutch
        displayName: "Nederlands",
        translateLangCode: "nl",
        htmlLangCode: "nl-NL",
        maxSubtitleChars: 96
    },
    { // Portuguese
        displayName: "Português",
        translateLangCode: "pt",
        htmlLangCode: "pt-PT",
        maxSubtitleChars: 96
    },
    { // Russian
        displayName: "русский язык",
        translateLangCode: "ru",
        htmlLangCode: "ru",
        maxSubtitleChars: 96
    },
    { // Swedish
        displayName: "Svenska",
        translateLangCode: "sv",
        htmlLangCode: "sv-SE",
        maxSubtitleChars: 96
    },
    { // Tamil
        displayName: "தமிழர்",
        translateLangCode: "ta",
        htmlLangCode: "ta",
        maxSubtitleChars: 60
    },
    { // Telegu
        displayName: "తెలుగు",
        translateLangCode: "te",
        htmlLangCode: "te",
        maxSubtitleChars: 60
    },
    { // Turkish
        displayName: "Türkçe",
        translateLangCode: "tr",
        htmlLangCode: "tr",
        maxSubtitleChars: 96
    },
    { // Chinese (Traditional)
        displayName: "中文 (繁體)",
        translateLangCode: "zh-TW",
        htmlLangCode: "zh-TW",
        maxSubtitleChars: 48
    }
];
