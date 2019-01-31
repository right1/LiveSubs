# LiveSubs
LiveSubs is a video chat web application that incorporates realtime translated subtitles and chat transcription.

This is an extended and more stable implementation of the project that was submitted for SpartaHack V (a 36-hour hackathon). You can view it's original source [here](https://github.com/bayyatej/LiveSubs).

Uses a WebSocket server to connect clients in the same room via simple-peer, allowing 2 languages per room.
Spectators can also join the room to participate or view the conversation in realtime as well.
Utilizes a Yandex Translate widget to translate all messages sent from the other language in the room.

This implementation currently only works on Chrome (desktop) due to Firefox requiring a TURN server for simple-peer and the WebSpeech API only being supported on Chrome.
