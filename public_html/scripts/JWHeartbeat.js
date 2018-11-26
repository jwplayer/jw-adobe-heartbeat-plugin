/* 
 * Please Note: This plugin implementation is a Proof of Concept only provided 
 * to show the possibilities of the JW Player and should not be taken as an 
 * offer to create, edit or maintain custom integration or development.
 */

/* This function is automatcally instantiated when referenced in the 
 * JWPlayer Config like so:
 *            plugins: {
 *               './scripts/JWHeartbeat.js' : {
 *                   adobeTrackingDomain: '<TRACKING SERVER DOMAIN>',
 *                   channelName: '<Channel Name>',
 *                   channel: <type of channel>,
 *                   pageName: <source page name>,
 *                   debug: <true or false>
 *               }
 *            }
 */
(function () { 

    var gDebugOn = false;
    
    // Simple debug function
    //
    function log(str, obj = null) {
        if (gDebugOn) {
            var msg = '[jwhb]: ' + str;
            if (obj !== null) console.log(msg, obj);
            else console.log(msg);
        }
    }
    
    // Setup default config values
    //
    var id = 'JWHeartbeat',  // Id name must be same name as .js file
        _defaults = {
            channelName : 'JW Heartbeat Plugin',
            adobeTrackingDomain : '',
            debug : false,
            pageName : 'pagename Not Set',
            channel : 'Video'
        };
        

    // This is the main plugin function.  It gets called by the player when
    // it is registered below.
    //
    var plugin = function (player, config) {
        
        // Local variables
        //
        var _ = player._,
            _config = _.extend({}, _defaults, config),
            _player = player,
            _state,
            _trackingServer = _config.adobeTrackingDomain,
            _adobeChannel = _config.channelName;            


        gDebugOn = _config.debug;
        
        log('plugin Initializing: config', _config); 
        
        if (_trackingServer === '') {
            console.log('[jwhb]: Tracking server not initialized.');
            return;
        }
        
        // Heartbeat initialization, 's' is defined in AppMeasurement.js
        //
        log('Setting AppMeasurement');
        s.pageName = _config.pageName;
        s.channel= _config.channel;
        var s_code=s.t();
        if(s_code) {
            log('writing s_code', s_code);                
            document.write(s_code);
        }
        
        // Variable initialization.  Some events produce data that is needed for
        // subsequent events, so we need to save the data
        //
        var _Heartbeat = {};            
        var _MediaInfo = {};
        var _CustomParams = {};
        var _AdPosition = 0;
     
        // Saves last known playback to determine actual playhead position based
        // on system time and on('time') event
        //
        var _LastKnownPlaybackPosition = 0;  
        var _LastSystemClock = 0;
    
        // Flags
        //
        var _sessionStarted = false;
        var _PlaySent = false;
        var _AdsPlaying = false;

        // Media Heartbeat variables
        //
        var _MediaHeartbeat = ADB.va.MediaHeartbeat, 
            _MediaHeartbeatConfig = ADB.va.MediaHeartbeatConfig,
            _MediaHeartbeatDelegate = ADB.va.MediaHeartbeatDelegate;
    
        // Code to initialize the heartbeat instance
        //
        function setupHeartbeat() {
            log('setupHeartbeat');
            
            // Media Heartbeat initialization
            //
            var mediaConfig = new _MediaHeartbeatConfig();
            mediaConfig.trackingServer = _trackingServer;
        
            var config = _player.getConfig();
            mediaConfig.playerName = config.pid;  // the JW Player ID
            mediaConfig.channel = _adobeChannel;
            mediaConfig.debugLogging = gDebugOn;
            mediaConfig.appVersion = _player.version;  // The JW Player version
            mediaConfig.ssl = false;
            mediaConfig.ovp = "JWPlayer";
            
            // Media Heartbeat Delegate
            //
            var mediaDelegate = new _MediaHeartbeatDelegate();
            
            // Create the mediaHeartbeat instance s is defined elsewhere.  
            //
            log('Creating the MediaHeartbeat object.', mediaConfig);
            _Heartbeat = new _MediaHeartbeat(mediaDelegate, mediaConfig, s);
            
            // Set mediaDelegate Current Playbacktime 
            //
            mediaDelegate.getCurrentPlaybackTime = function() {
                /* Position to return is last known position + difference in milliseconds
                 * between 'now' and 'the last saved clock.
                 */
                var state  = player.getState();
                var pos;
                if ((state === 'playing') && (_LastSystemClock > 0) && !_AdsPlaying) {
                    var d = new Date();
                    pos = _LastKnownPlaybackPosition + ((d.getTime() - _LastSystemClock) /1000);        
                } else {
                    pos = _LastKnownPlaybackPosition;
                }
                log('mediaDelegate.getCurrentPlaybackTime: position ' + pos + ' state: ' + player.getState() +
                        ' Ads Playing: ' + _AdsPlaying);        
                return pos;
            };  
            mediaDelegate.getQoSObject = function() {
                var rate = 0;
                log('_getQosObject: Enter');
                var quality = player.getVisualQuality(); 
                if (quality) {
                    rate = quality.level.bitrate;
                }
                var qos =  _MediaHeartbeat.createQoSObject(rate, 0, 0, 0);
                return qos;
            }
        }
        // Create an Error string of the player error
        //
        function createErrorString(data) {
            var cache = [];
            var str = JSON.stringify(data, function(key, value) {
                if (typeof value === 'object' && value !== null) {
                    if (cache.indexOf(value) !== - 1) {
                        // Duplicate reference found
                        try {
                            // If this value does not reference a parent it can be deduped
                            return JSON.parse(JSON.stringify(value));
                        } catch (error) {
                            // discard key if value cannot be deduped
                            return;
                        }
                    }
                    // Store value in our collection
                    cache.push(value);
                }
                return value;
            });
            cache = null; // Enable garbage collection               
            return str;
        }
        
        // Advertising Events
        // 
        function adStartBreak(name, pos, start) {
            if (!_AdsPlaying) {
                // Replace <ADBREAK_NAME> with the AdBreak name.
                // Replace <POSITION> with a valid position value.
                // Replace <START_TIME> with the AdBreak start time.
                log('adStartBreak: Send #trackEvent:AdStartBreak');
                var adBreakInfo = _MediaHeartbeat.createAdBreakObject(name, pos, start);
                _Heartbeat.trackEvent(_MediaHeartbeat.Event.AdBreakStart, adBreakInfo); 
                _AdsPlaying = true;
                _AdPosition = 0;
            } else {
                _AdPosition++;  // Just increase the adPosition value
                log('adStartBreak: Ad in position ' + _AdPosition + ' starting');                                
            }
        }
        function resetSession() {
            log('Send #trackSessionEnd');                         
            _Heartbeat.trackSessionEnd();        
            _sessionStarted = false;  // Will need to reinitialize for next video
            _PlaySent = false;      // Reset.
        }

        function setupListeners() {

            log('setupListeners');
            
            // When playlistItem fires, get the information and create a MediaInfo object
            // to be used to start the session
            //
            player.on('playlistItem', function (info) {
                log('playlistItem', info.item);
                var title = 'unknown';
                var mediaid = 'unknown';
            
                if (info.item.hasOwnProperty('title')) {
                    title = info.item.title;
                }
                if (info.item.hasOwnProperty('mediaid')) {
                    mediaid = info.item.mediaid;
                } else if (info.item.hasOwnProperty('file')) {
                    mediaid = info.item.file;
                }                
                
                // Set media info information
                // MediaHeartbeat.createMediaObject(<VIDEO_NAME>, <VIDEO_ID>, <VIDEO_LENGTH>,MediaHeartbeat.StreamType.VOD);
                //
                _MediaInfo = _MediaHeartbeat.createMediaObject(title, String(mediaid), 
                    player.getDuration(), _MediaHeartbeat.StreamType.VOD);
                
                // Set standard video metadata
                //
                var standardVideoMetadata = {};
                standardVideoMetadata[_MediaHeartbeat.VideoMetadataKeys.ASSET_ID] = mediaid;
                _MediaInfo.setValue(_MediaHeartbeat.MediaObjectKey.StandardVideoMetadata, standardVideoMetadata);
                
                // Note that JWP Custom Parameters are also available in the metadata object and
                // can be sent to Adobe heartbeat. e.g. If not tracking custom parameters
                // then send 'null' to trackSessionStart
                //
                _CustomParams = {};
                // For example, if there is a JW Custom parameter with key 'import_guid'
                //
                //_CustomParams.guid = metadata.import_guid;  

                // Initialize play positions
                //
                _LastKnownPlaybackPosition = 0;
                _LastSystemClock = 0;
                _PlaySent = false;
                
            });
    
            // A video or ad is about to begin playing
            //   TODO: Maybe this should be player.once?
            //
            player.on('beforePlay', function (data) {
        
                log('beforePlay event, position: ', player.getPosition());
        
                // Initialize the Heartbeat for this session
                // The JW event can get called multiple times with a position of 0,
                // but should only initialize the heartbeat session once
                //
                if (player.getPosition() === 0) {
                    
                    if (!_sessionStarted) {
                        log('Send #trackSessionStart');                
                        _sessionStarted = true;
                        
                        // Start Session, This signals the user's intent to watch video
                        // 
                        _Heartbeat.trackSessionStart(_MediaInfo, _CustomParams);
                    }
                }
                // If the current state is paused, then resend a play event
                //
                var state = player.getState();
                if (state === 'paused') {
                    log('beforePlay: Send #trackPlay()');
                    _Heartbeat.trackPlay();                           
                }
            });
    
            // FirstFrame of content has been played.
            //
            player.on('firstFrame', function (data) {
                log('firstFrame');    
                
                // If haven't sent the play event then send it.  Note that it's possible the
                // play vent was sent when the AdStart event was signaled
                // 
                if (!_PlaySent) {
                    log('firstFrame: Send #trackPlay');                
                    _Heartbeat.trackPlay();        
                    _PlaySent = true;
                }
            });
            
            // Save the current system clock, and current playback position being
            // reported to calclulate the playback position at a later time
            //
            player.on('time', function (data) {
                var d = new Date();
                _LastSystemClock = d.getTime();
                _LastKnownPlaybackPosition = data.position;
            });
            
            player.on('adTime', function (data) {
                var d = new Date();
                _LastSystemClock = d.getTime();
                _LastKnownPlaybackPosition = data.position;
            });
    
            // Seeking Events
            //
            player.on('seek', function (data) {
                log('Send #trackEvent:SeekStart'); 
                _Heartbeat.trackEvent(_MediaHeartbeat.Event.SeekStart);        
            });

            player.on('seeked', function (data) {
                log('Send #trackEvent:SeekComplete'); 
                _LastKnownPlaybackPosition = player.getPosition();  // Save last known position        
                _Heartbeat.trackEvent(_MediaHeartbeat.Event.SeekComplete);        
            });
    

    
            // User paused the video
            //
            player.on('pause', function (data) {
                log('send #trackPause'); 
                _Heartbeat.trackPause();        
            });
    
            // If the play event is fired and ads were playing,
            // then send the AdBreakComplete event.  There is 
            // no ad playback end event
            //
            player.on('play', function (data) {
                log('play Event'); 
                if (_AdsPlaying) {
                    log('play: Send #trackEvent:AdBreakComplete');             
                    _Heartbeat.trackEvent(_MediaHeartbeat.Event.AdBreakComplete);            
                    _AdsPlaying = false;
                }
            });
            
            // Video (and ads) have completed
            //
            player.on('complete', function (data) {
                log('complete');
                
                // If an ad was playing (POST-ROLL), send the AdBreakComplete
                //
                if (_AdsPlaying) {
                    log('complete: (POST-ROLL) Send #AdBreakComplete');             
                    _Heartbeat.trackEvent(_MediaHeartbeat.Event.AdBreakComplete);            
                    _AdsPlaying = false;
                }
                log('Send #trackComplete');         
                _Heartbeat.trackComplete();
                resetSession();
            });            
            
            // Only send the buffer event if the session has been started
            // We don't send one just because the player loaded and pre-buffered
            //            
            player.on('buffer', function (data) {
                if (_sessionStarted) {
                    log('Send #trackEvent:BufferStart');
                    _Heartbeat.trackEvent(_MediaHeartbeat.Event.BufferStart);        
                }
            });
            player.on('bufferFull', function (data) {
                if (_sessionStarted) {                
                    log('Send #trackEvent:BufferComplete');        
                    _Heartbeat.trackEvent(_MediaHeartbeat.Event.BufferComplete);                
                }
            });
            // 
            // Error Handling
            //
            player.on('error', function (data) {
                log('(error) Send #trackError');

                //
                // Send all the error data as a string
                //
                _Heartbeat.trackError(createErrorString(data));
                
                // error means the player stopped so reset the session
                resetSession();
            });
            
            // Handle a setup error.  Since the player hasn't even started to play, the
            // code needs to send a session start, the error, then the session end
            //
            player.on('setupError', function (data) {
                if (!_sessionStarted) {
                    var config = player.getConfig();
                    var title = 'unknown';
                    var mediaId = 'unknown';
                    
                    // See if we can get the title and media ID out of the setup config
                    //
                    if (config.hasOwnProperty('setupConfig')) {
                        console.log('setupConfig exists');
                        var setupConfig = config.setupConfig;
                        if (setupConfig.hasOwnProperty('playlist')) {
                            console.log('playlist exists');
                            var playlist = setupConfig.playlist;
                            if (Array.isArray(playlist)) {
                                console.log('playlist is array');
                                if (playlist[0].hasOwnProperty('title')) {
                                    title = playlist[0].title;
                                }
                                if (playlist[0].hasOwnProperty('mediaid')) {
                                    mediaid = playlist[0].mediaid;
                                }
                            }
                        }
                    }
                    // Create the info needed for the session start
                    //
                    var info = _MediaHeartbeat.createMediaObject(title, String(mediaId), 
                        0, _MediaHeartbeat.StreamType.VOD);
                
                    // Set standard video metadata
                    //
                    var standardVideoMetadata = {};
                    standardVideoMetadata[_MediaHeartbeat.VideoMetadataKeys.ASSET_ID] = String(mediaId);
                    info.setValue(_MediaHeartbeat.MediaObjectKey.StandardVideoMetadata, standardVideoMetadata);    
                    log('eventHandler: (setupError) Send #trackSessionStart');                                    
                    _Heartbeat.trackSessionStart(info, {});                
                }
                log('eventHandler: (setupError) Send #trackError');                
                _Heartbeat.trackError(createErrorString(data));   

                resetSession();
            });

    
            // Use the adImpression event to signal that an ad is being started
            //
            player.on('adImpression', function (data) {
                log('adImpression');
                
                // Start the adBreak if needed
                //
                adStartBreak(data.adtitle, data.position, _LastKnownPlaybackPosition);
                
                // Create an adObject and custom metadata to track the ad
                //
                var adObject = _MediaHeartbeat.createAdObject(data.adtitle, data.id, _AdPosition, data.duration);
                var adCustomMetadata = {
                    tag: data.tag,
                    client: data.client
                };
                
                // Send the AdStart event
                //
                log('adImpression: Send #trackEvent:AdStart');
                _Heartbeat.trackEvent(_MediaHeartbeat.Event.AdStart, adObject, adCustomMetadata);
                
                // Note: The documentation says that after the first ad in a Pre-roll
                // starts to play, the 'trackPlay' event should be sent.  But, it seems,
                // in practice, this does not work correctly.  The adStart event that is sent
                // above in the adImpression handler, automatically kicks off the trackPlay
                // event.  Thus, just set the gPlaySent flag to true, so it is not sent again
                //
                if (!_PlaySent) {
                    _PlaySent = true;
                    log('adImpression: Sent #trackPlay');
                    _Heartbeat.trackPlay();                                        
                }
                // Set the flag that an Ad is playing
                //
                _AdsPlaying = true;
            });
            
            // ad is being played.
            // If haven't sent the trackPlay event, then send it
            //
            player.on('adPlay', function (data) {
                log('adPlay');
                if (!_PlaySent) {
                    log('adPlay: Send #trackPlay');            
                    _Heartbeat.trackPlay();                    
                    _PlaySent = true;
                }
            });
            player.on('adStarted', function (data) {
                log('adStarted. do nothing.');
            });
            
            player.on('adSkipped', function (data) {
                log('adSkipped: Send #trackEvent:AdSkip');
                _Heartbeat.trackEvent(_MediaHeartbeat.Event.AdSkip); 
                
                // Set the flag to false so the AdBreakComplete is not sent
                // unless a new ad starts playing
                _AdsPlaying = false;
            });

            player.on('adComplete', function (data) {
                log('adComplete: Send #trackEvent:AdComplete');
                _Heartbeat.trackEvent(_MediaHeartbeat.Event.AdComplete); 
            });
            player.on('adBreakEnd', function (data) {
                log('eventHandler: adBreakEnd');
            
                // If an ad was playing send the AdBreakComplete
                //
                if (_AdsPlaying) {
                    log('adBreakEnd: Send #trackEvent:AdBreakComplete');             
                    _Heartbeat.trackEvent(_MediaHeartbeat.Event.AdBreakComplete);            
                    _AdsPlaying = false;
                }
            });
            player.on('remove', function (data) {
                // Close the session if it's still in progress
                if (_sessionStarted) {
                    log('remove: session in progress. stop it');
                    resetSession();
                } else {
                    log('remove: session not in progress. do nothing.');                    
                }
            });
        }  // setupListeners  
        
        // Main code for plugin
        //
        log('initializing heartbeat plugin');
        setupHeartbeat();
        setupListeners();
        log('initializing complete');        
        
    }  // End of Plugin Code
    
    // Initialize the plugin
    //
    plugin.version = '1.0.0';

    console.log('[jwhb]: RegisterPlugin');
    var registerPlugin = window.jwplayerPluginJsonp || window.jwplayer().registerPlugin;
    registerPlugin(id, '8.0.0', plugin);

})();    



