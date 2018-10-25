Repository for JW Player customers wanting to integrate Adobe Video Analytics (Heartbeat SDK) with the JW Player.

This version of the repository uses Adobe Analytics plugins Version 2.1.1 from Sep. 21, 2018

For an overview of configuring the Javascript Heartbeat Plugins see: https://marketing.adobe.com/resources/help/en_US/sc/appmeasurement/hbvideo/set-up-js.html

## Files :
* scripts/AppMeasurement.js - Adobe provided 
* scripts/VisitorAPI.js - Adobe provided
* scripts/VideoHeartbeat.min.js - Adobe provided
* scripts/JWHeartbeat.js - JW Provided plugin that connects JW Player events to Adobe Heartbeat SDK
* scripts/AdobeHeartbeatBasic.html - Simple page that shows how to configure the JW Player to use the JWHeartbeat plugin 

## How-to :

1. Modify AppMeasurement.js with your Adobe Credentials - See https://marketing.adobe.com/resources/help/en_US/sc/implement/js_implementation.html and
https://marketing.adobe.com/resources/help/en_US/sc/implement/appmeasure_mjs_pagecode.html for the example code
2. Modify VisitorAPI.js with your Adobe Credentials - See https://marketing.adobe.com/resources/help/en_US/mcvid/mcvid-setup-analytics.html
3. Create a Web Page that: (See AdobeHeartbeatBasic.html for example)
  1. References AppMeasurement.js, VideoHeartbeat.min.js, VisitorAPI.js, JWHeartbeat.j
  2. Creates a JW Player using a Config object that includes the JWHeartbeat plugin
    


