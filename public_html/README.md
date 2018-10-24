Repository for JW Player customers wanting to integrate Adobe Video Analytics (Heartbeat SDK) with the JW Player.

This version of the repository uses Adobe Analytics plugins Version 2.1.1 from Sep. 21, 2018

For an overview of configuring the Javascript Heartbeat Plugins see: https://marketing.adobe.com/resources/help/en_US/sc/appmeasurement/hbvideo/set-up-js.html

## Files :
* AppMeasurement.js - Adobe provided 
* VisitorAPI.js - Adobe provided
* VideoHeartbeat.min.js - Adobe provided
* JWHeartbeat.js - JW Provided plugin that connects JW Player events to Adobe Heartbeat SDK
* AdobeHeartbeatBasic.html - Simple page that shows how to configure the JW Player to use the JWHeartbeat plugin 

## How-to :

1. Modify AppMeasurement.js with your Adobe Credentials - See https://marketing.adobe.com/resources/help/en_US/sc/implement/js_implementation.html
2. Modify VisitorAPI.js with your Adobe Credentials - See https://marketing.adobe.com/resources/help/en_US/mcvid/mcvid-setup-analytics.html
3. Create a Web Page that: (See AdobeHeartbeatBasic.html for example)
  a. References AppMeasurement.js, VideoHeartbeat.min.js, VisitorAPI.js, JWHeartbeat.j
  b. Creates a JW Player using a Config object that includes the JWHeartbeat plugin
    


