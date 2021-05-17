console.log("Document loaded")

var server = "http://192.168.87.123:8088/janus"; //Hardcoded - Must be dynamically changable. 

var janus;
var mixertest;
var opaqueId;
var webrtcUp = false;
var stream;
var audioenabled = false;
var myroom = 1234;	//Preconfigured demo room, very convenient.

//Embedded stuff in the START-function, so it doesn't just zoom off on its own.
function start(server) {
    Janus.init({debug: "all", callback: function() {

        //Escapes init if webrtc isn't supported.
        if(!Janus.isWebrtcSupported()) {
            bootbox.alert("No WebRTC support... ");
            return;
        }
        
        //New Janus instance created. All code is in the init of this instance.
        
            janus = new Janus({
    
            server: server, 
            success: function() {
                
                console.log("Connection to " + server + " established.");
                
                console.log("Attempting to attach audiobridge plugin");
                
                //Attaching plugin
                janus.attach({
                    plugin: "janus.plugin.audiobridge",
                    opaqueId: opaqueId,
                    success: function(pluginHandle) {
                        mixertest = pluginHandle;
                        Janus.log("Plugin attached! (" + mixertest.getPlugin() + ", id=" + mixertest.getId() + ")");
                        readyVC();
                    },
                    error: function(error) {
                        Janus.error("Plugin error", error);
                    
                    },
                    mediaState: function(medium, on) {
                        Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                    },
                    webrtcState: function(on) {
                        Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                    },
                    onmessage: function(msg, jsep) {
                        Janus.debug("Audiobridge recieved a message: ", msg);
                        var event = msg["audiobridge"];
                        if(event) {
                            if(event === "joined") {
                                console.log("Voice chat to Jauns established.")
                                if(!webrtcUp) {
                                    webrtcUp = true;
                                    // Publish our stream
                                    mixertest.createOffer({
                                        media: { video: false},	// This is an audio only room
                                        success: function(jsep) {
                                            Janus.debug("Got SDP!", jsep);
                                            var publish = { request: "configure", muted: false };
                                            mixertest.send({ message: publish, jsep: jsep });
                                        },
                                        error: function(error) {
                                            Janus.error("WebRTC error:", error);
                                        }
                                    });
                                }
                            } else if(msg["error"]) {
                                if(msg["error_code"] === 485) {
                                   console.log("No such fucking room, buster")
                                } else {
                                    console.log(msg["error"]);
                                }
                                return;
                            } 
                        } 
                        if(jsep) {
                            Janus.debug("Handling SDP as well...", jsep);
                            mixertest.handleRemoteJsep({ jsep: jsep });
                        }
                    },
                    onremotestream: function(stream) {
                        //This shouldn't ever be called I think. It could clash with the stream mixer however, I'm not sure.
                        console.log("Yeah, you fucked something up I think. Someone else is in this same room, aren't they? I recieved: " + stream)
                    }
       
                });
                
                attachStreaming();
            }
        });
        
    }});
}

function readyVC() {
    mixertest.send({ message: { request: "join", room: 1234, display: "anal" }});
    mixertest.send({ message: { request: "rtp_forward", room: 1234, host: "localhost", port: 7088, secret: "adminpwd", always_on : true }});
}

function attachStreaming() {
    janus.attach({
        plugin: "janus.plugin.streaming",
        opaqueId: opaqueId,

        success: function(pluginHandle) {

            stream = pluginHandle;
            Janus.log("Plugin attached");

            //Tell Janus to listen on port 7089 for RTP packages. These are supplied by GStreamer.
            stream.send({ message:{
                request : "create",
                type : "rtp", 
                description : "Recieve RTP audio from GStreamer",
                secret : "adminpwd",
                is_private : false,
                id: 10,
                audio : true,
                video: false,
                audioport : 7089,
                audiopt: 111,
                audiortpmap: "opus/48000/2",
                media: [{type: "audio"}]
                } 
            });

            //Tell Janus the browser wants to hear whatever comes in on previously created listener.
            stream.send({ message:{
                request : "watch",
                id: 10
                }
            });
            
        },
        error: function(error) {
            Janus.error("Plugin error", error);
        },
        webrtcState: function(on) {
            Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
        },
        onremotestream: function(streem) {
            //We attach the audio from recieved remote stream to our roomaudio element.
            console.log("Audiostream recieved")
            audioenabled = true;
            yeet = document.createElement("audio")
            yeet.setAttribute("id", "roomaudio");
            document.getElementById("field").append(yeet);
            Janus.attachMediaStream(document.getElementById("roomaudio"), streem);
            document.getElementById("roomaudio").play();
            document.getElementById("roomaudio").volume = 1;
            
        },
        onmessage: function(msg, jsep) {
            Janus.debug("Streaming-plugin recieved a message: ", msg);
            var event = msg["streaming"];
            if(event) {
                //Currently no event manipulation.                
            } 
            if(jsep) {
                stream.createAnswer(
                    {
                        jsep: jsep,
                        // We want recvonly audio/video and, if negotiated, datachannels
                        media: { audioSend: false, videoSend: false, data: true },
                        customizeSdp: function(jsep) {
                           //We don't need to do anything this stage. Can be removed.
                        },
                        success: function(jsep) {
                            Janus.debug("Got SDP!", jsep);
                            var body = { request: "start" };
                            stream.send({ message: body, jsep: jsep });
                        },
                        error: function(error) {
                            Janus.error("WebRTC error:", error);

                        }
                    }
                );
            }
        }
    });
}

//For quick testing - it attaches to a streaming-room.
function watch(cum) {
    stream.send({ message:{
        request : "watch",
        id: 10
        }
    });
}

//Request information about the room with (ID)
function info(cum) {
    stream.send({ message:{
        request : "info",
        id : cum,
        secret : "adminpwd"
        } 
    });  
}

//This function just stops everything from being recieved. Works on both plugins.
function itsTimeToStop() {
    stream.send({ message:{
        request : "stop"
        }  
    });
}

//Gets a list of listenable rooms. 1,2,3 and 4 are preconfigured demo rooms. These can be removed in the Janus config, which I was too lazy to do myself.
function getList() {
    stream.send({ message:{
        request : "list"
        }  
    });
}