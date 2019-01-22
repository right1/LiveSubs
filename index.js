var Peer=require('simple-peer');
const buffer=require('buffer')
// var userInstance;//simple-peer client instance
var roomName;//roomname to create for testing
const videoOptions={
    video: true,
    audio: true
}
var peerInstances={};//username: instance
var password;
var clientPeerId;
var username;
var muted=false;
var connection;//Websocket connection to server
$(function(){
    $('#muteSwitch_muted').hide();
    $('#muteSwitch_unmuted').hide();
    navigator.mediaDevices.getUserMedia(videoOptions).then(function(stream) {
        gotMedia(stream)
      })
      .catch(function(err) {
        console.error(err)
      });
    window.WebSocket = window.WebSocket || window.MozWebSocket;
    function gotMedia(stream){
        var video = document.getElementById('self');
        video.srcObject = stream;
        // video.load();
        video.play();
        // userInstance=new Peer({initiator: true,stream: stream})
        connection=new WebSocket('wss://localhost:8443');
        // connection.onopen=function(){
            
        // }
        
        connection.onerror=function(error){
            console.error(error)
        }
        connection.onmessage=function(message){
            var data=JSON.parse(message.data)
            console.log(data)
            if(data.type==='roomCreation'){
                if(data.success===2){
                    // userInstance=new Peer({initiator: true,trickle:false,stream: stream})
                    $('.login-ui').hide();
                }else if(data.success===1){
                    // userInstance=new Peer({initiator: false,trickle:false,stream: stream})
                    $('.login-ui').hide();
                    for(var i=0;i<data.usernames.length;i++){
                        
                        let newPeer=new Peer({stream:stream});//this peer will wait for signal before doing anything.
                        peerSetup(newPeer,false,data.usernames[i])
                    }
                }else if(data.success===0){
                    $('#connectionErrorMsg').text(data.message);
                }
            }else if(data.type==='newUser'){
               
                let newPeer=new Peer({stream:stream,initiator:true});
                peerSetup(newPeer,true,data.username)
                
            }else if(data.type==="peerId"){
                if(data.initiator){
                    peerInstances[data.username]['peer'].signal(data.id);
                }else{
                    peerInstances[data.username]['peer'].signal(data.id);
                }
            }
        }
        $('#muteSwitch_muted').click(function(){
            muted=false;
            $('#muteSwitch_unmuted').show();
            $('#muteSwitch_muted').hide();
            stream.getAudioTracks()[0].enabled = true;
        })
        $('#muteSwitch_unmuted').click(function(){
            muted=true;
            stream.getAudioTracks()[0].enabled = false;
            $('#muteSwitch_muted').show();
            $('#muteSwitch_unmuted').hide();
        })
        $('#selfContainer').mouseenter(function(){
            if(muted){
                $('#muteSwitch_muted').show()
            }else{
                $('#muteSwitch_unmuted').show()
            }
        })
        $('#selfContainer').mouseleave(function(){
            if(muted){
                $('#muteSwitch_muted').hide(100)
            }else{
                $('#muteSwitch_unmuted').hide(100)
            }
        })
    }
    
    function peerSetup(p,init,otherUsername){
        // newPeer.signal(signalData);
        p.on('data',onDataReceived)
        peerInstances[otherUsername]={"init": init, "peer": p}
        p.on('signal',function(data){
            data=JSON.stringify(data);
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
        p.on('connect',function(data){
            console.log('connected')
        })
        p.on('stream',function(otherStream){
            var video=document.createElement('video');
            video.id=otherUsername+"_video";
            document.getElementById('videoBar').appendChild(video);
            video.srcObject=otherStream;
            // video.onended=function(){
            //     console.log(otherUsername+' video ended')
            //     $('#'+otherUsername+'_video').remove();
            // }
            video.play();
        })
        
    }
    $('#connect').click(function(){
        username=$('#username').val();
        roomName=$('#roomName').val();
        password=$('#password').val();
        var datatosend=JSON.stringify({
            "type": 'roomRequest',
            "roomName": roomName,
            "password": password,
            "username": username
        })
        connection.send(datatosend)
    })
    $('#send').click(function(){
        sendToAll("bro")
    })
    $("video").bind("ended", function() {
        console.log('ended')
     });
    function sendToAll(data){
        //send data as string buffer shit isn't really working .stringify if necessary
        console.log(peerInstances);
        for(var i in peerInstances){
            var val=peerInstances[i];
            val['peer'].send(data);
        }
    }
    function onDataReceived(data){
        console.log(data)
        console.log(data.toString());
    }
})


