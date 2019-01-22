var Peer=require('simple-peer');
const buffer=require('buffer')
// var userInstance;//simple-peer client instance
var roomName="test";//roomname to create for testing
const videoOptions={
    video: true,
    audio: true
}
var peerInstances={};//username: instance
var password;
var clientPeerId;
var username=Math.floor(Math.random()*1000);
var connection;//Websocket connection to server
$(function(){
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
        connection.onopen=function(){
            var datatosend=JSON.stringify({
                "type": 'roomRequest',
                "roomName": 'hello',
                "password": "",
                "username": username
            })
            connection.send(datatosend)
        }
        
        connection.onerror=function(error){
            console.error(error)
        }
        connection.onmessage=function(message){
            var data=JSON.parse(message.data)
            if(data.type==='roomCreation'){
                if(data.success===2){
                    // userInstance=new Peer({initiator: true,trickle:false,stream: stream})
                }else if(data.success===1){
                    // userInstance=new Peer({initiator: false,trickle:false,stream: stream})
                    for(var i=0;i<data.usernames.length;i++){
                        
                        let newPeer=new Peer({stream:stream});//this peer will wait for signal before doing anything.
                        peerSetup(newPeer,false,data.usernames[i])
                    }
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
                "roomName": "hello"
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
            video.play();
        })
        
    }
    $('#send').click(function(){
        sendToAll("bro")
    })
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


