# LiveSubs
Live translated subtitles/chat transcription

Uses a websocket server to connect clients in the same room via simple-peer, allowing 2 languages per room.
Utilises a yandex translate widget to translate all messages sent from the other language in the room.

This implementation currently only works on Chrome (desktop/Android) due to Firefox requiring a TURN server for simple-peer and the WebSpeech API only being supported on Chrome.

Todo:
-Implement old spotlight and hark hotswapping code
-Implement old subtitle code ontop of spotlight video
