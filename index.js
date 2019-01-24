var Peer = require('simple-peer');
const buffer = require('buffer')
// const translate=require('@vitalets/google-translate-api');
// var userInstance;//simple-peer client instance
var roomName;//roomname to create for testing
var isSpectator = false;
const videoOptions = {
    video: true,
    audio: true
}
var messages = [];
// import adapter from 'webrtc-adapter'
var peerInstances = {};//username: instance
var password;
// var clientPeerId;
var username;
var muted = false;
var languageIndex = 0; // Default to English.
var connection;//Websocket connection to server
var translateTo;//index of language to translate to
let protectTranslations=true;
// var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
$(function () {
    $(".select2").select2();
    $('.chatBoxParent').hide();
    var langSelects = [document.getElementById('langSelectC1'), document.getElementById('langSelectC2'), document.getElementById('langSelectJ')];
    for (let i = 0; i < languages.length; i++) {
        //populate language dropdown

        for (var j = 0; j < langSelects.length; j++) {
            let option = document.createElement("option");
            option.value = i;
            option.text = languages[i].displayName;
            langSelects[j].add(option)
        }
        // let html="<option value='"+i+"'>"
        // html+=languages[i].displayName;
        // html+="</option>";
        // $('#langSelect').append(html);
    }
    $(document).keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            if($('#chatEnter').is(":focus")){
                let msgText=$('#chatEnter').val();
                $('#chatEnter').val("");
                const msg={
                    "username": username,
                    "message": msgText,
                    "type": 1,//type 1: chat
                    "sl": languageIndex,
                    "timestamp": Date.now()
                }
                messages.push(msg);
                updateChatMessages(messages.length-1)
                sendToAll(JSON.stringify(msg))
            }
        }
    });
    $('.login-ui').hide()
    $('#langSelectC1').change(function () {
        languageIndex = $(this).children("option:selected").val();
        if (typeof languageIndex === "string") {
            languageIndex = parseInt(languageIndex);
        }
        console.log(languageIndex);
    })
    $('#langSelectJ').change(function () {
        languageIndex = $(this).children("option:selected").val();
        if (typeof languageIndex === "string") {
            languageIndex = parseInt(languageIndex);
        }
        console.log(languageIndex);
    })
    $('#joinRoom').click(function () {
        $('#login-ui_join').show()
        $('.typeSelect').hide()
    })
    $('#createRoom').click(function () {
        $('#login-ui_create').show()
        $('.typeSelect').hide()
    })
    $('#muteSwitch_muted').hide();
    $('#muteSwitch_unmuted').hide();
    navigator.mediaDevices.getUserMedia(videoOptions).then(function (stream) {
        gotMedia(stream)
    })
        .catch(function (err) {
            //Start in spectator mode
            startConnection(false);
            isSpectator = true;
            $('.spectate').hide();
            console.error(err)
        });
    window.WebSocket = window.WebSocket || window.MozWebSocket;
    function gotMedia(stream) {
        var video = document.getElementById('self');
        video.srcObject = stream;
        // video.load();
        video.play();
        startConnection(stream);
        // userInstance=new Peer({initiator: true,stream: stream})

    }
    function startConnection(stream) {
        connection = new WebSocket('wss://localhost');
        // connection.onopen=function(){

        // }

        connection.onerror = function (error) {
            console.error(error)
        }
        connection.onmessage = function (message) {
            var data = JSON.parse(message.data)
            console.log(data)
            if (data.type === 'roomCreation') {
                if (data.success >= 1) {
                    beginSpeechRecognition();
                    $('.chatBoxParent').show();
                    $('#roomDisplay').text(data.roomName);
                    $('#languageDisplay').text(languages[languageIndex]['displayName']);
                    let elHeight=$( window ).height();
                    elHeight-=$('#topChat').height();
                    elHeight-=$('#chatEnter').height();
                    elHeight-=12;
                    $('.chatBox').height(elHeight);
                }
                if (data.success === 2) {
                    // userInstance=new Peer({initiator: true,trickle:false,stream: stream})
                    loadjscssfile("https://translate.yandex.net/website-widget/v1/widget.js?widgetId=ytWidget&pageLang=" + languages[translateTo]['translateLangCode'] + "&widgetTheme=light&autoMode=true", "js")
                    $('.login-ui').hide();
                } else if (data.success === 1) {
                    // userInstance=new Peer({initiator: false,trickle:false,stream: stream})
                    $('.login-ui').hide();
                    translateTo = data.translateTo;
                    loadjscssfile("https://translate.yandex.net/website-widget/v1/widget.js?widgetId=ytWidget&pageLang=" + languages[translateTo]['translateLangCode'] + "&widgetTheme=light&autoMode=true", "js")
                    for (var i = 0; i < data.usernames.length; i++) {
                        let newPeer;
                        if (stream&&!isSpectator) {
                            newPeer = new Peer({ stream: stream });//this peer will wait for signal before doing anything.
                        } else {
                            newPeer = new Peer();
                        }
                        peerSetup(newPeer, false, data.usernames[i])
                    }
                } else if (data.success === 0) {
                    $('.connectionErrorMsg').text(data.message);
                }
            } else if (data.type === 'newUser') {
                let newPeer;
                if (stream&&!isSpectator) {
                    newPeer = new Peer({ stream: stream, initiator: true });
                } else {
                    newPeer = new Peer({ initiator: true });
                }
                peerSetup(newPeer, true, data.username)

            } else if (data.type === "peerId") {
                peerInstances[data.username]['peer'].signal(data.id);
            }
        }
        if (stream) {
            $('#muteSwitch_muted').click(function () {
                muted = false;
                $('#muteSwitch_unmuted').show();
                $('#muteSwitch_muted').hide();
                stream.getAudioTracks()[0].enabled = true;
            })
            $('#muteSwitch_unmuted').click(function () {
                muted = true;
                stream.getAudioTracks()[0].enabled = false;
                $('#muteSwitch_muted').show();
                $('#muteSwitch_unmuted').hide();
            })
            $('#selfContainer').mouseenter(function () {
                if (muted) {
                    $('#muteSwitch_muted').show()
                } else {
                    $('#muteSwitch_unmuted').show()
                }
            })
            $('#selfContainer').mouseleave(function () {
                if (muted) {
                    $('#muteSwitch_muted').hide(100)
                } else {
                    $('#muteSwitch_unmuted').hide(100)
                }
            })
        }

    }
    function peerSetup(p, init, otherUsername) {
        // newPeer.signal(signalData);
        p.on('data', onDataReceived)
        peerInstances[otherUsername] = { "init": init, "peer": p }
        p.on('signal', function (data) {
            data = JSON.stringify(data);
            console.log('signal')
            connection.send(JSON.stringify({
                "type": "peerId",
                "id": data,
                "username": username,
                "target": otherUsername,
                "initiator": init,
                "roomName": roomName,
                "password": password
            }))
        })
        p.on('connect', function (data) {
            messages.push({
                "username": otherUsername,
                "message": "connected",
                "type": 0,//type 0: new user joined
                "timestamp": Date.now()
            })
            updateChatMessages(messages.length-1)
        })
        p.on('stream', function (otherStream) {
            console.log(otherStream)
            var video = document.createElement('video');
            video.id = otherUsername + "_video";
            document.getElementById('videoBar').appendChild(video);
            video.srcObject = otherStream;
            // video.onended=function(){
            //     console.log(otherUsername+' video ended')
            //     $('#'+otherUsername+'_video').remove();
            // }
            video.play();
        })

    }
    $('#connectC').click(function () {
        username = $('#usernameC').val();
        roomName = $('#roomNameC').val();
        password = $('#passwordC').val();
        let languages = [languageIndex, 0];
        languages[1] = $('#langSelectC2').children("option:selected").val();
        if (typeof languages[1] === "string") {
            languages[1]= parseInt(languages[1]);
        }
        translateTo = languages[1];
        if ($('#spectateC').is(":checked")) {
            isSpectator = true;
        }
        var datatosend = JSON.stringify({
            "type": 'roomRequest',
            "roomName": roomName,
            "password": password,
            "username": username,
            "languages": languages
        })
        if (username.length > 0 && roomName.length > 0) {
            connection.send(datatosend)
        }

    })
    $('')
    $('#connectJ').click(function () {
        username = $('#usernameJ').val();
        roomName = $('#roomNameJ').val();
        password = $('#passwordJ').val();
        if ($('#spectateJ').is(":checked")) {
            isSpectator = true;
        }
        var datatosend = JSON.stringify({
            "type": 'roomRequest',
            "roomName": roomName,
            "password": password,
            "username": username,
            "language": languageIndex
        })
        if (username.length > 0 && roomName.length > 0) {
            connection.send(datatosend)
        }

    })
    $(".yt-button__text").on('DOMSubtreeModified', "mydiv", function() {
        var lang=$(".yt-button__text").text();
        if(lang.toLowerCase()!==languages[languageIndex]['translateLangCode']){
            protectTranslations=false;
        }else{
            protectTranslations=true;
        }
        console.log(lang,languages[languageIndex]['translateLangCode'],protectTranslations);
    });
    // $('#send').click(function () {
    //     sendToAll(JSON.stringify({
    //         "username": username,
    //         "message": "I eat the fish",
    //         "type": 1,//type 1: chat
    //         "sl": languages[languageIndex]['translateLangCode'],
    //         "timestamp": Date.now()
    //     }));
    //     messages.push({
    //         "username": username,
    //         "message": "No one's ever called me a bro before, the only people who've used that term with me are assailants.",
    //         "type": 1,//type 1: chat
    //         "sl": languages[languageIndex]['translateLangCode'],
    //         "timestamp": Date.now()
    //     })
    //     updateChatMessages(messages.length - 1)
    // })
    // $("video").bind("ended", function() {
    //     console.log('ended')
    //  });

    function onDataReceived(data) {
        data = JSON.parse(data);
        if (data.type === 2 || data.type===1) {
            //translate the message
            console.log(data);
            messages.push(data);
            updateChatMessages(messages.length - 1);
            // translate(data.message,{from:data.sl,to:languages[languageIndex]['translateLangCode']}).then(res => {
            //     data.message=res;
            //     messages.push(data);
            //     updateChatMessages(messages.length-1);
            //     console.log(data);
            // })

        }
    }
})
function loadjscssfile(filename, filetype) {
    if (filetype == "js") { //if filename is a external JavaScript file
        var fileref = document.createElement('script')
        fileref.setAttribute("type", "text/javascript")
        fileref.setAttribute("src", filename)
    }
    else if (filetype == "css") { //if filename is an external CSS file
        var fileref = document.createElement("link")
        fileref.setAttribute("rel", "stylesheet")
        fileref.setAttribute("type", "text/css")
        fileref.setAttribute("href", filename)
    }
    if (typeof fileref != "undefined")
        document.getElementsByTagName("head")[0].appendChild(fileref)
}
function sendToAll(data) {
    //send data as string buffer shit isn't really working .stringify if necessary
    console.log(peerInstances);
    for (var i in peerInstances) {
        var val = peerInstances[i];
        val['peer'].send(data);
    }
}
function updateChatMessages(index) {
    if(index>-1){
        if(messages[index].type===2){
            var messageHTML="<p "
            if(protectTranslations){
                messageHTML+='translate="no" '
            }
            messageHTML+="><span class='usernameDisplayS2T' translate='no'>" + messages[index]['username'] + ": </span>";
            messageHTML += messages[index]['message'] + '</p>';
            $('.chatBox').html($('.chatBox').html()+ messageHTML);
        }
        else if(messages[index].type===1){
            var messageHTML="<p "
            if(messages[index]['sl']===languageIndex){
                messageHTML+='translate="no" '
            }
            messageHTML+="><span class='usernameDisplayChat'>" + messages[index]['username'] + ": </span>";
            messageHTML += messages[index]['message'] + '</p>';
            $('.chatBox').html($('.chatBox').html()+ messageHTML);
        }
        else if(messages[index].type===0){
            var messageHTML = "<p><span class='usernameDisplayJoin'>" + messages[index]['username'] + " </span>";
            messageHTML += messages[index]['message'] + '</p>'
            $('.chatBox').html($('.chatBox').html()+ messageHTML);
        }
    }
    console.log('called update chat')
    
}
function beginSpeechRecognition() {
    console.log('began');

    window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

    const recognition = new window.SpeechRecognition();
    recognition.onresult = (event) => {
        const speechToText = event.results[0][0].transcript;
        transmitSpeech(speechToText);
    }
    recognition.onaudiostart = function (event) {
    }
    recognition.onaudioend = function (event) {
        recognition.stop();
        startRecognition(25);
    }
    function startRecognition(delay) {
        setTimeout(function () {
            try {
                recognition.lang = languages[languageIndex].htmlLangCode;
                recognition.start();
            } catch (e) {
                startRecognition(delay);
            }
        }, delay)
    }

    // Start recognition loop.
    startRecognition(10);
}

function transmitSpeech(message) {
    console.log(message);
    message = message.trim(); // Remove whitespace.

    if (message.length == 0 || muted) {
        return;
    }

    // Capitalize the transcribed message, we are treating it as a sentence.
    // message = capitalizeSentence(message);

    if (message.charAt(message.length - 1) == '.') {
        // Remove periods picked up (sometimes) from the speech recognition.
        // We are automatically handling this.
        message = message.substring(0, message.length - 1);
    }

    const msg = {
        "username": username,
        "message": message,
        "type": 2,//type 2:speech recognition.
        "sl": languageIndex,
        "timestamp": Date.now()
    };

    // Send message to all peers.
    sendToAll(JSON.stringify(msg))

    // Update our message list locally.
    messages.push(msg);
    updateChatMessages(messages.length - 1);
}
