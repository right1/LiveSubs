const Peer = require('simple-peer');
const hark = require('hark');

const MSG_TYPE_WELCOME = 0;
const MSG_TYPE_USER_JOINED = 1;
const MSG_TYPE_CHAT = 2;
const MSG_TYPE_SPEECH = 3;
const MSG_TYPE_HARK = 4;

const CONNECT_FAILED = 0;
const CONNECT_JOINED = 1;
const CONNECT_CREATED = 2;
// const translate=require('@vitalets/google-translate-api');
// var userInstance;//simple-peer client instance
var isSpectator = false;
const videoOptions = {
    video: true,
    audio: true
};
var messages = [];
// import adapter from 'webrtc-adapter'
var peerInstances = {}; //username: instance
var password;
// var clientPeerId;
var username; // The local user's name.
var roomName; // our current room name.
var muted = false;
var languageIndex = 0; // Default to English.
var translateTo = 0; // Index of language to translate to
var connection; // Websocket connection to server
let protectTranslations = true;
var gracePeriod = false;
// var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

$(function () {
    // Setup some webpage extensions.
    $(".select2").select2();
    $('[data-toggle="tooltip"]').tooltip();
    var langDropdowns = [document.getElementById('langSelectC1'), document.getElementById('langSelectC2'), document.getElementById('langSelectJ')];

    // Populate language dropdowns.
    for (let i = 0; i < langDropdowns.length; i++) {
        // Pull languages array from speech.js
        for (var j = 0; j < languages.length; j++) {
            let option = document.createElement("option");
            option.value = j;
            option.text = languages[j].displayName;
            langDropdowns[i].add(option);
        }
    }

    // Register chat enter key callback.
    $(document).keypress(function (event) {
        var keycode = (event.keyCode ? event.keyCode : event.which);
        const ENTER_KEY = 13;

        if (keycode === ENTER_KEY) {
            if ($('#chatEnter').is(":focus")) {
                let msgText = $('#chatEnter').val();
                $('#chatEnter').val("");

                let trimmedMsg = msgText.trim();

                if (trimmedMsg.length == 0) {
                    return; // don't send empty messages.
                }

                const msg = {
                    "username": username,
                    "message": msgText,
                    "type": MSG_TYPE_CHAT,
                    "sl": languageIndex,
                    "timestamp": Date.now()
                }

                messages.push(msg);
                updateChatMessages(true);
                sendToAll(JSON.stringify(msg))
            }
        }
    });

    $('#langSelectC1').change(function () {
        languageIndex = $(this).children("option:selected").val();
        languageIndex = parseInt(languageIndex);
    })
    $('#langSelectJ').change(function () {
        languageIndex = $(this).children("option:selected").val();
        languageIndex = parseInt(languageIndex);
    })

    $('.login-ui').hide();
    $('.chatBoxParent').hide();

    $('#joinRoom').click(function () {
        $('#login-ui_join').show();
        $('.typeSelect').hide();
        $('.buttonContainer').hide();
    })
    $('#createRoom').click(function () {
        $('#login-ui_create').show();
        $('.typeSelect').hide();
        $('.buttonContainer').hide();
    })

    // Password reveal setup.
    $('#showPwdC').show();
    $('#hidePwdC').hide();

    $('#showPwdC').click(function () {
        // Reveal password field.
        $('#showPwdC').hide();
        $('#hidePwdC').show();
        $('#passwordC').attr('type', 'text');
    })
    $('#hidePwdC').click(function () {
        // Hide password field.
        $('#showPwdC').show();
        $('#hidePwdC').hide();
        $('#passwordC').attr('type', 'password');
    })

    $('#showPwdJ').show();
    $('#hidePwdJ').hide();

    $('#showPwdJ').click(function () {
        // Reveal password field.
        $('#showPwdJ').hide();
        $('#hidePwdJ').show();
        $('#passwordJ').attr('type', 'text');
    })
    $('#hidePwdJ').click(function () {
        // Hide password field.
        $('#showPwdJ').show();
        $('#hidePwdJ').hide();
        $('#passwordJ').attr('type', 'password');
    })

    $('#muteSwitch_muted').hide();
    $('#muteSwitch_unmuted').hide();

    // Some sort of thing.
    navigator.mediaDevices.getUserMedia(videoOptions).then(function (stream) {
        gotMedia(stream);
    }).catch(function (err) {
        // Start in spectator mode if we failed to get user media.
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
                if (data.success === CONNECT_JOINED || data.success === CONNECT_CREATED) {
                    // Created or joined the room

                    // Begin speech recognition.
                    beginSpeechRecognition();

                    // Setup chat area.
                    $('.chatBoxParent').show();
                    roomName = data.roomName;
                    $('#roomDisplay').text(roomName);
                    $('#languageDisplay').text(languages[languageIndex]['displayName']);
                    let elHeight = $(window).height();
                    elHeight -= $('#topChat').height();
                    elHeight -= $('#chatEnter').height();
                    elHeight -= 30; // padding.
                    $('.chatBox').css('bottom', ($('#chatEnter').height() + 5) + 'px');
                    $('.chatBox').height(elHeight);

                    // Clear and display welcome message for the joining user only.
                    messages.push({
                        "username": username,
                        "message": "",
                        "type": MSG_TYPE_WELCOME,
                        "timestamp": Date.now()
                    });

                    updateChatMessages(false);
                }

                if (data.success === CONNECT_CREATED) {
                    // Created and joined the room.
                    // userInstance=new Peer({initiator: true,trickle:false,stream: stream})
                    loadJsCssFiles("https://translate.yandex.net/website-widget/v1/widget.js?widgetId=ytWidget&pageLang=" + languages[translateTo]['translateLangCode'] + "&widgetTheme=light&autoMode=true", "js")
                    $('.login-ui').hide();
                } else if (data.success === CONNECT_JOINED) {
                    // userInstance=new Peer({initiator: false,trickle:false,stream: stream})
                    $('.login-ui').hide();
                    translateTo = data.translateTo;

                    if(translateTo == -1) {
                        // If we get code -1, then it's most likely that the 2 room languages are the same somehow.
                        // In this case, fallback to user's selected language so we don't get index out of range.
                        translateTo = languageIndex;
                    }

                    loadJsCssFiles("https://translate.yandex.net/website-widget/v1/widget.js?widgetId=ytWidget&pageLang=" + languages[translateTo]['translateLangCode'] + "&widgetTheme=light&autoMode=true", "js")
                    for (var i = 0; i < data.usernames.length; i++) {
                        let newPeer;
                        if (stream && !isSpectator) {
                            newPeer = new Peer({
                                stream: stream
                            }); //this peer will wait for signal before doing anything.
                        } else {
                            newPeer = new Peer();
                        }
                        peerSetup(newPeer, false, data.usernames[i])
                    }
                } else if (data.success === CONNECT_FAILED) {
                    // TODO: Use bootstrap notify.
                    $('.connectionErrorMsg').text(data.message);
                }
            } else if (data.type === 'newUser') {
                let newPeer;
                if (stream && !isSpectator) {
                    newPeer = new Peer({
                        stream: stream,
                        initiator: true
                    });
                } else {
                    newPeer = new Peer({
                        initiator: true
                    });
                }

                peerSetup(newPeer, true, data.username);

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
                    $('#muteSwitch_muted').hide(75);
                } else {
                    $('#muteSwitch_unmuted').hide(75);
                }
            })
            var speechEvents = hark(stream, {});
            speechEvents.on('speaking', function () {
                const harkMsg = {
                    "username": username,
                    "message": false,
                    "type": MSG_TYPE_HARK,
                    "sl": languageIndex,
                    "timestamp": Date.now()
                };
                sendToAll(JSON.stringify(harkMsg));
            });
        }
    }

    function peerSetup(p, init, otherUsername) {
        // newPeer.signal(signalData);
        p.on('data', onDataReceived)
        peerInstances[otherUsername] = {
            "init": init,
            "peer": p
        }
        p.on('signal', function (data) {
            data = JSON.stringify(data);
            console.log('sending to server peerid');
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
            // New user joined
            messages.push({
                "username": otherUsername,
                "message": "",
                "type": MSG_TYPE_USER_JOINED,
                "timestamp": Date.now()
            });

            updateChatMessages(true);
        })
        p.on('stream', function (otherStream) {
            console.log(otherStream)
            var video = document.createElement('video');
            video.id = otherUsername + "_video";
            if ($("#spotlight video").length == 0) {
                $('#spotlight').prepend(video);
                $('#subtitleParent').css("width", $('#spotlight video').width())
            } else {
                document.getElementById('videoBar').appendChild(video);
            }

            video.srcObject = otherStream;
            // video.onended=function(){
            //     console.log(otherUsername+' video ended')
            //     $('#'+otherUsername+'_video').remove();
            // }
            video.play();
        })

    }

    $('#backC').click(backToMainMenu);
    $('#backJ').click(backToMainMenu);

    function backToMainMenu() {
        $('#login-ui_create').hide();
        $('#login-ui_join').hide();
        $('.typeSelect').show();
        $('.buttonContainer').show();
    }

    $('#connectC').click(function () {
        username = $('#usernameC').val();
        roomName = $('#roomNameC').val();
        password = $('#passwordC').val();
        let languages = [languageIndex, 0];
        languages[1] = $('#langSelectC2').children("option:selected").val();
        if (typeof languages[1] === "string") {
            languages[1] = parseInt(languages[1]);
        }
        translateTo = languages[1];
        if ($('#spectateC').is(":checked")) {
            isSpectator = true;
        }
        var payload = JSON.stringify({
            "type": 'roomRequest',
            "roomName": roomName,
            "password": password,
            "username": username,
            "languages": languages
        })
        if (username.length > 0 && roomName.length > 0) {
            connection.send(payload);
        }
    });

    $('#connectJ').click(function () {
        username = $('#usernameJ').val();
        roomName = $('#roomNameJ').val();
        password = $('#passwordJ').val();
        if ($('#spectateJ').is(":checked")) {
            isSpectator = true;
        }
        var payload = JSON.stringify({
            "type": 'roomRequest',
            "roomName": roomName,
            "password": password,
            "username": username,
            "language": languageIndex
        })
        if (username.length > 0 && roomName.length > 0) {
            connection.send(payload);
        }
    });

    $(".yt-button__text").on('DOMSubtreeModified', "mydiv", function () {
        var lang = $(".yt-button__text").text();
        if (lang.toLowerCase() !== languages[languageIndex]['translateLangCode']) {
            protectTranslations = false;
        } else {
            protectTranslations = true;
        }
        console.log(lang, languages[languageIndex]['translateLangCode'], protectTranslations);
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
    //     updateChatMessages()
    // })
    // $("video").bind("ended", function() {
    //     console.log('ended')
    //  });

    function onDataReceived(data) {
        data = JSON.parse(data);
        if (data.type === MSG_TYPE_CHAT || data.type === MSG_TYPE_SPEECH) {
            //translate the message
            console.log(data);
            messages.push(data);
            setSpotlight(data.username);
            updateChatMessages(true);
            // translate(data.message,{from:data.sl,to:languages[languageIndex]['translateLangCode']}).then(res => {
            //     data.message=res;
            //     messages.push(data);
            //     updateChatMessages();
            //     console.log(data);
            // })

        }
        if (data.type === MSG_TYPE_HARK && !gracePeriod) { //hark
            setSpotlight(data.username);
        }
    }
})

function setSpotlight(user) {
    if ($('#spotlight video').length < 1 || $('#videoBar video').length < 1) {
        return;
    }

    let newSpotlight = $('#' + user + "_video").detach();
    if ($('#spotlight video').length == 1) $('#subtitle').text(''); //resetting subtitle if the spotlight is cast to a different user.
    let oldSpotlight = $('#spotlight').children("video").detach();
    // Swap places with spotlight and small video.
    $('#spotlight').prepend(newSpotlight);
    $('#videoBar').append(oldSpotlight);
    $('#subtitleParent').css("width", $('#spotlight video').width());
}

function loadJsCssFiles(filename, filetype) {
    if (filetype == "js") { //if filename is a external JavaScript file
        var fileref = document.createElement('script');
        fileref.setAttribute("type", "text/javascript");
        fileref.setAttribute("src", filename);
    }
    else if (filetype == "css") { //if filename is an external CSS file
        var fileref = document.createElement("link");
        fileref.setAttribute("rel", "stylesheet");
        fileref.setAttribute("type", "text/css");
        fileref.setAttribute("href", filename)
    }
    if (typeof fileref != "undefined")
        document.getElementsByTagName("head")[0].appendChild(fileref)
}

function sendToAll(data) {
    //send data as string buffer shit isn't really working .stringify if necessary
    console.log('Sending to peer instances:', peerInstances);
    for (var i in peerInstances) {
        var val = peerInstances[i];
        val['peer'].send(data);
    }
}

function setSubtitleText(text) {
    let maxSubChars = languages[languageIndex].maxSubtitleChars;
    const subtitle = document.getElementById('subtitle');
    let fullText = subtitle.textContent;

    if (fullText.length > 0) {
        // Prepend a space if there is something already.
        fullText += ' ';
    }

    // Append the new sentence and period.
    fullText += text + '.';

    if (fullText.length > maxSubChars) {
        // Prepend ellipsis when previous sentences are cut off.
        fullText = '...' + fullText.substr(fullText.length - maxSubChars, fullText.length);
    }
    console.log('subtitles updated to: ' + fullText);

    subtitle.textContent = fullText;
    let subParent = $('#subtitleParent');
    let curFontSize = 32;
    let targetSubtitleHeight = curFontSize * 2; // Desired subtitles element height to approx. two lines.
    subParent.css('font-size', curFontSize);

    while (subParent.height() > targetSubtitleHeight) {
        subParent.css('font-size', curFontSize);
        curFontSize -= 2;
    }
    // Automatically anchor subtitles to bottom of spotlight video.
    subParent.css('bottom', ($('#spotlight').height() - $('#spotlight video').height() + window.innerHeight * .035) + 'px');
}

function updateChatMessages(addToSub) {
    if (messages.length > 0) {
        let index = messages.length - 1;

        if (messages[index].type === MSG_TYPE_SPEECH) {
            var messageHTML = "<p "

            // Do not translate messages that are in the user's own language.
            if (messages[index].sl === languageIndex && protectTranslations) {
                messageHTML += 'translate="no" ';
            }

            // Append speech transcription to chat.
            messageHTML += "><span class='usernameDisplayS2T' translate='no'>" + messages[index]['username'] + ": </span>";
            messageHTML += messages[index]['message'] + '</p>';
            $('.chatBox').html($('.chatBox').html() + messageHTML);

            if (addToSub) {
                // Append to subtitles.
                setSubtitleText(messages[index]['message']);
                gracePeriod = true;
                setTimeout(function () {
                    gracePeriod = false;
                }, 1000)
            }
        } else if (messages[index].type === MSG_TYPE_CHAT) {
            var messageHTML = "<p "

            if (messages[index].sl === languageIndex) {
                messageHTML += 'translate="no" ';
            }

            // Append message to chat.
            messageHTML += "><span class='usernameDisplayChat'>" + messages[index]['username'] + ": </span>";
            messageHTML += messages[index]['message'] + '</p>';
            $('.chatBox').html($('.chatBox').html() + messageHTML);
        } else if (messages[index].type === MSG_TYPE_USER_JOINED) {
            // Append join message to chat.
            let messageHTML = "<p><span class='usernameDisplayJoin' translate='no'>" + messages[index]['username'] + "</span> joined the room!</p>";
            $('.chatBox').html($('.chatBox').html() + messageHTML);
        } else if (messages[index].type === MSG_TYPE_WELCOME) {
            // Append welcome message to chat.
            let messageHTML = "<p>Hello, <span class='usernameDisplayJoin' translate='no'>" + messages[index]['username'] + "</span>. Welcome to <span translate='no'><strong>";
            messageHTML += roomName;
            messageHTML += "</strong></span>!</p>";
            $('.chatBox').html($('.chatBox').html() + messageHTML);
        }
    }
}

function beginSpeechRecognition() {
    console.log('Began speech recognition');
    window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

    const recognition = new window.SpeechRecognition();
    recognition.onresult = (event) => {
        const speechToText = event.results[0][0].transcript;
        transmitSpeech(speechToText);
    }
    recognition.onaudiostart = function (event) { }
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

    var msg = {
        "username": username,
        "message": message,
        "type": MSG_TYPE_SPEECH,
        "sl": languageIndex,
        "timestamp": Date.now()
    };

    // Send message to all peers.
    sendToAll(JSON.stringify(msg))

    // Update our message list locally.
    messages.push(msg);
    updateChatMessages(false);
}