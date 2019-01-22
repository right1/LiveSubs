var Peer=require('simple-peer');
var userInstance;//simple-peer client instance
var roomName="test";//roomname to create for testing
const videoOptions={
    video: true,
    audio: true
}
var peerInstances=[];
var password;
var clientPeerId;
$(function(){
    console.log('ran')
    navigator.mediaDevices.getUserMedia(videoOptions).then(function(stream) {
        gotMedia(stream)
      })
      .catch(function(err) {
        console.error(err)
      });
    window.WebSocket = window.WebSocket || window.MozWebSocket;
    function gotMedia(stream){
        console.log('got stream')
        // userInstance=new Peer({initiator: true,stream: stream})
        var connection=new WebSocket('wss://localhost:8443');
        connection.onopen=function(){
            var datatosend=JSON.stringify({
                "type": 'roomRequest',
                "roomName": 'hello',
                "password": ""
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
                    userInstance=new Peer({initiator: true,trickle:false,stream: stream})
                }else if(data.success===1){
                    userInstance=new Peer({initiator: false,trickle:false,stream: stream})
                    for(var i=0;i<data.peerIds.length;i++){
                        console.log(data.peerIds[i])
                        
                        let newPeer=new Peer();
                        peerSetup(newPeer,data.peerIds[i])
                    }
                }
                userInstance.on('signal',function(data){
                    clientPeerId=JSON.stringify(data);
                    var datatosend=JSON.stringify({
                        "roomName": "hello",
                        "password": "",
                        "type": "addId",
                        "id": clientPeerId
                    })
                    connection.send(datatosend)
                })
                userInstance.on('data',function(data){
                    onDataReceived(data);
                })
            }else if(data.type==='newId'){
                console.log(data.id)
               
                let newPeer=new Peer({initiator:true});
                peerSetup(newPeer,data.id)
                
            }
            
            
            
        }
        
    }
    function peerSetup(p,signalData){
        newPeer.signal(signalData);
        newPeer.on('data',onDataReceived)
        peerInstances.push(newPeer)
    }
    $('#send').click(function(){
        console.log(peerInstances)
        for(var i=0;i<peerInstances.length;i++){
            peerInstances[i].send('hello '+i)
        }
    })
    function onDataReceived(data){
        console.log(data);
    }
    // function sendTestMessage(){
        
    // }
})


