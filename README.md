# modelderivative-nodejs-tutorial

[![Node.js](https://img.shields.io/badge/Node.js-4.4.0-blue.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-3.10.7-green.svg)](https://www.npmjs.com/)
![Platforms](https://img.shields.io/badge/platform-windows%20%7C%20osx%20%7C%20linux-lightgray.svg)
[![License](http://img.shields.io/:license-mit-blue.svg)](http://opensource.org/licenses/MIT)
[![oAuth2](https://img.shields.io/badge/oAuth2-v1-green.svg)](http://developer.autodesk.com/)


[![Viewer](https://img.shields.io/badge/ForgeAPI-v0.0.3-green.svg)](http://developer.autodesk.com/)

## Description

The following project is a demonstration of the use of the Forge API Node package module to recreate the following workflow. 

-	Create a 2-legged authentication token
-	Create a bucket (an arbitrary space to store objects)
-  Get a list of all available buckets
-	Upload a file to the bucket
-	Prepare the file for displaying in the Viewer (translate the file into SVF format)

![](images/md-nodejs-terminal.png) 

### Steps to debug

Follow these instructions to get the app running locally:

	> git clone <THIS-REPO>
	> cd TO-REPO-PATH	
	> npm install
	> set FORGE_CLIENT_ID=<<YOUR CLIENT ID FROM DEVELOPER PORTAL>
	> set FORGE_CLIENT_SECRET=<<YOUR CLIENT SECRET>
   	> node uploader.js
   	  
This will install all the neccesary dependencies the project has, which are specified in the package.json file, and also run you the steps speciefied before to get as a result the URN of your transalated file. 

This URN can be used in the following project  
[Viewer-nodejs-tutorial] (https://github.com/Autodesk-Forge/viewer-nodejs-tutorial)

## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT).
Please see the [LICENSE](LICENSE) file for full details.

## Written by
Jaime Rosales D. <br /> 
[![Twitter Follow](https://img.shields.io/twitter/follow/afrojme.svg?style=social&label=Follow)](https://twitter.com/AfroJme)<br />
Forge Partner Development <br />
<a href="http://developer.autodesk.com/">Forge Developer Portal</a> <br />
