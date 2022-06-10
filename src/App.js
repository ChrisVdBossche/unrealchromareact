import React, {useState, useEffect} from "react";
import './App.css';
import './Buttons.css';
import './Sliders.css';
import ToggleSwitch from './ToggleSwitch/ToggleSwitch';
import $ from 'jquery';

//==================================================================================================

//  d888b  db       .d88b.  d8888b.  .d8b.  db      .d8888. 
// 88' Y8b 88      .8P  Y8. 88  `8D d8' `8b 88      88'  YP 
// 88      88      88    88 88oooY' 88ooo88 88      `8bo.   
// 88  ooo 88      88    88 88~~~b. 88~~~88 88        `Y8b. 
// 88. ~8~ 88booo. `8b  d8' 88   8D 88   88 88booo. db   8D 
//  Y888P  Y88888P  `Y88P'  Y8888P' YP   YP Y88888P `8888Y' 

//==================================================================================================
                                                       
//How many unreal servers are actually used?
const numUnreals = 3;
//How many cameras are actually in use for each unreal server? (1,2,3)
const numCams = 2;

//unreal server status (unreal 1-2-3)
var uStatus = new Array(3);	//unreal status
var oldStatus = new Array(3);	//To avoid unneeded, blink-disturbing update of status widgets
var uActive = new Array(3);	//unreal active or not
var masterUnreal = 0; //No unreal as master yet
var masterData;		//Remember data from master, to send to other unreals

//key-fill checkbox status (cam 1-2-3)
var alphaState = new Array(3); 
var fillState = new Array(3);

//Node.js server that translates unreal commands
const nodeServerIP = "localhost:8800";

//Amount of Unreal controlling widgets
const numFloats = 23;
const numBools = 2;
const numColors = 2;
//Slider scale factor
const SlScale = 1000.0;

//Status symbols
const Online = Symbol("Unreal_Online");
const NoUnreal = Symbol("No_Unreal_listening");
const NoServer = Symbol("Server_Not_Found");
const Refused = Symbol("Connection_Refused");
const TimedOut = Symbol("Request_timed_out");
const BadRequest = Symbol("Bad_Request");
const Unknown = Symbol("Unknown status");
const NotUsed = Symbol("Not Used");
const Stopped = Symbol("Unreal_Stopped");

//Timing
var intervalId = null;  //ID for polling
var blinkingId = null;  //ID for blinking
var startTime = Date.now();
const minInterval = 20; //Shortest interval to send commands (20ms is our 50fps TV time-quantum)
const PollingInterval = 5000; //Auto-refresh timers in ms
const BlinkTimer = 400;	//Blinking alerts
var BlinkOn = true;	//Color on or off
var isPolling = true;  //Interval polling enabled or not
var colorUpdate = true; //Can we update color values? (true if from user input, false if from setting widget)
var tel,tel2,unreal;

//==================================================================================================

// d888888b d8b   db d888888b d888888b d888888b  .d8b.  db      d888888b .d8888. d88888b 
//   `88'   888o  88   `88'   `~~88~~'   `88'   d8' `8b 88        `88'   88'  YP 88'     
//    88    88V8o 88    88       88       88    88ooo88 88         88    `8bo.   88ooooo 
//    88    88 V8o88    88       88       88    88~~~88 88         88      `Y8b. 88~~~~~ 
//   .88.   88  V888   .88.      88      .88.   88   88 88booo.   .88.   db   8D 88.     
// Y888888P VP   V8P Y888888P    YP    Y888888P YP   YP Y88888P Y888888P `8888Y' Y88888P 

//==================================================================================================

//====== Initializing Globals ======
for(tel=0;tel<3;tel++) {
	uStatus[tel] =  Unknown;
	uActive[tel] =  false;
	alphaState[tel] = false;
	fillState[tel] = false;
}

//===== Initially activate an Unreal ==========
//uActive[0] = true;	//server 1 active on startup
//uActive[1] = true;	//server 2 active on startup
//uActive[2] = true;	//server 3 active on startup

//===== Initialize client panel ===============
console.log("Starting timers...");
//Sync every few seconds so we always have unreal status
StartPollingTimer(PollingInterval);
//Timer for blinking alerts	
StartBlinkingTimer();


//===========================================================================================================

// .d8888. d88888b d8b   db d8888b.   d888888b  .d88b.     db    db d8b   db d8888b. d88888b  .d8b.  db      
// 88'  YP 88'     888o  88 88  `8D   `~~88~~' .8P  Y8.    88    88 888o  88 88  `8D 88'     d8' `8b 88      
// `8bo.   88ooooo 88V8o 88 88   88      88    88    88    88    88 88V8o 88 88oobY' 88ooooo 88ooo88 88      
//   `Y8b. 88~~~~~ 88 V8o88 88   88      88    88    88    88    88 88 V8o88 88`8b   88~~~~~ 88~~~88 88      
// db   8D 88.     88  V888 88  .8D      88    `8b  d8'    88b  d88 88  V888 88 `88. 88.     88   88 88booo. 
// `8888Y' Y88888P VP   V8P Y8888D'      YP     `Y88P'     ~Y8888P' VP   V8P 88   YD Y88888P YP   YP Y88888P 
                                                                                                         
//===========================================================================================================
                                                                                                                                                                                                           
//====== Set status and UI when a failure is received ======
function HandleFailure(unreal, data)
{
	const status = data.status;
	if(status) {
		if(data.responseJSON) {
			const msg = data.responseJSON.errorMessage;
			if(msg) {
				//console.log("FAIL status:",status," Msg:",msg); 
				if((msg.substr(msg.length - 10)) === "not exist.") {
					SetUnrealServerStatus(unreal, Stopped); //Unreal not in PLAY
				} else if(msg==="ECONNREFUSED") {
					SetUnrealServerStatus(unreal, NoUnreal); //No unreal on this host, show "offline"
				} else if(msg==="ENOTFOUND") {
					SetUnrealServerStatus(unreal, NoServer); //Server not found
				} else if(msg==="ETIMEDOUT" || msg==="ECONNABORTED") {
					SetUnrealServerStatus(unreal, TimedOut); //Connection Time-out
				} else {
					SetUnrealServerStatus(unreal, BadRequest); //Bad request
				}
			} else {
				//console.log("FAIL no errorMessage:",status,"No message"); 
				SetUnrealServerStatus(unreal, BadRequest); //Bad request
			}
		} else {
			//console.log("FAIL no responseJSON:",status);
			SetUnrealServerStatus(unreal, BadRequest); //Bad request
		}
	} else {
		//console.log("FAIL no status:",data);
		SetUnrealServerStatus(unreal, BadRequest); //Bad request
	}
}





//====== Send a value to Unreal via node.js server ======
function SendValue(unreal, pType, pCamNr, pIndex, pValue)  //unrealnr, camnr: 1-based, index: 0-based
{
	const um1 = unreal-1;
	if(!uActive[um1] || uStatus[um1]!==Online) return; //unreal not active and online
	const url = "http://" + nodeServerIP + "/SetValue";
	
	const param = {
		unrealServer:unreal,
		type:pType, 
		camNr:pCamNr, 
		index:pIndex, 
		value:pValue
	}	//The body
//	console.log("client POST: ",url,param);
//POST this to our server
	$.ajax({
        type: "POST",
        url: url,
		contentType: 'application/json',
        dataType: "json",
		data: JSON.stringify(param),
    })
	.done(function(data) {  //replaces the .success function
		SetUnrealServerStatus(unreal, Online); //No data to process. Just set status online
	})
    .fail(function(data) {  	//replaces the .error: function
		HandleFailure(unreal, data);
	})
    .always(function() { 
//		console.log("Complete"); 
	});
}



//====== Ask all values through nodejs server from Unreal via node.js server ======
function SyncFromUnreal(unreal) //unrealnr: 1-based
{
	const um1 = unreal-1;
	if(!uActive[um1]) return; //Skip if Unreal not active

	const url = "http://" + nodeServerIP + "/GetAllValues";

	const param = {
		unrealServer:unreal
	}	//The body
	console.log("client POST: ",url,param);
//POST this to our server
	$.ajax({
        type: "POST",
        url: url,
		contentType: 'application/json',
        dataType: "json",
		data: JSON.stringify(param),
    })
	.done(function(data) {  //replaces the .success function
		SetUnrealServerStatus(unreal, Online); 
		SetWidgetsAllCams(unreal, data);	//Set the widgets with received data
	})
    .fail(function(data) {  	//replaces the .error: function
		HandleFailure(unreal, data);
	})
    .always(function() { 
		FlashPollingLabel();
//		console.log("Complete"); 
	});
}




//====== Call other functions in Unreal via node.js server ======
function CallFunction(unreal, pType, pCamNr) //A single integer: Camera nr
{
	const um1 = unreal-1;
	if(!uActive[um1] || uStatus[um1]!==Online) return; //unreal not active and online

	const url = "http://" + nodeServerIP + "/CallFunction";
	
	const param = {
		unrealServer:unreal,
		type:pType, 
		camNr:pCamNr, 
	}	//The body
	console.log("client POST: ",url,param);
//POST this to our server
	$.ajax({
        type: "POST",
        url: url,
		contentType: 'application/json',
        dataType: "json",
		data: JSON.stringify(param),
    })
	.done(function(data) {  //replaces the .success function
		SetUnrealServerStatus(unreal, Online); //No data to process. Just set status online
		setTimeout(function() { //Sync with a small delay to allow unreal to execute 
			SyncFromUnreal(unreal);
		}, 100);
	})
    .fail(function(data) {  	//replaces the .error: function
		HandleFailure(unreal, data);
	})
    .always(function() { 
//		console.log("Complete"); 
	});
}

//====== Intended to send all parameters from master to other unreal(s) ======
function CallFunction2(unreal, pType, pData) //An object: pData
{
	const um1 = unreal-1;
	if(!uActive[um1] || uStatus[um1]!==Online) return; //unreal not active and online

	const url = "http://" + nodeServerIP + "/CallFunction2";
	
	const param = {
		unrealServer:unreal,
		type:pType, 
		data:pData, 
	}	//The body
//	console.log("client POST: ",url,param);
//POST this to our server
	$.ajax({
        type: "POST",
        url: url,
		contentType: 'application/json',
        dataType: "json",
		data: JSON.stringify(param),
    })
	.done(function(data) {  //replaces the .success function
		SetUnrealServerStatus(unreal, Online); //No data to process. Just set status online
		//No sync needed: Slave unreals do not display their data
	})
    .fail(function(data) {  	//replaces the .error: function
		HandleFailure(unreal, data);
	})
    .always(function() { 
//		console.log("Complete"); 
	});
}

// //TEST TEST TEST TEST TEST TEST TEST TEST TEST
// function TestGet(unreal)
// {
// 	console.log("Test");
// }


// //TEST TEST TEST TEST TEST TEST TEST TEST TEST
// //Send "get all params" directly to Unreal
// function SyncFromUnrealDirect(unreal) //unrealnr: 1-based
// {

// //	const url = "http://127.0.0.1:7010/remote/object/call";
// 	const url = "http://10.210.20.24:7010/remote/object/call";
// //	const url = "http://10.210.20.44:7010/remote/object/call";
// const pparam = {
// 		"objectPath" : "/Game/PeetieLevels/UEDPIE_0_00_VirtualSet.00_VirtualSet:PersistentLevel.ChromakeyController"
// 		,"functionName" : "GetAllParamsFromAllCams"
// 		,"generateTransaction" : true 
// 	};
// //	console.log("client POST: ",url,param);
// //POST this to our server
// 	$.ajax({
//         type: "PUT",
//         url: url,
// 		contentType: 'application/json',
//         dataType: "json",
// 		data: JSON.stringify(pparam),
//     })
// 	.done(function(data) {  //replaces the .success function
// 		console.log("Received data from Unreal:",data);
// 		SetUnrealServerStatus(unreal, Online); 
// 		SetWidgetsAllCams(unreal, data);	//Set the widgets with received data
// 	})
//     .fail(function(data) {  	//replaces the .error: function
// 		HandleFailure(unreal, data);
// 	})
//     .always(function() { 
// 		FlashPollingLabel();
// 		console.log("ajax PUT call Complete"); 
// 	});
// }

//===============================================================================================================

// .d8888. d88888b d8b   db d8888b. d88888b db    db d8b   db  .o88b. d888888b d888888b  .d88b.  d8b   db .d8888. 
// 88'  YP 88'     888o  88 88  `8D 88'     88    88 888o  88 d8P  Y8 `~~88~~'   `88'   .8P  Y8. 888o  88 88'  YP 
// `8bo.   88ooooo 88V8o 88 88   88 88ooo   88    88 88V8o 88 8P         88       88    88    88 88V8o 88 `8bo.   
//   `Y8b. 88~~~~~ 88 V8o88 88   88 88~~~   88    88 88 V8o88 8b         88       88    88    88 88 V8o88   `Y8b. 
// db   8D 88.     88  V888 88  .8D 88      88b  d88 88  V888 Y8b  d8    88      .88.   `8b  d8' 88  V888 db   8D 
// `8888Y' Y88888P VP   V8P Y8888D' YP      ~Y8888P' VP   V8P  `Y88P'    YP    Y888888P  `Y88P'  VP   V8P `8888Y' 
                                                                                                                 
//===============================================================================================================
                                                                                                                 
//====== Call Unreal functions with a friendly name ======
function CopyCamSettingsTo(unreal, pCamNr)  
{ 
	CallFunction(unreal, 0, pCamNr); //type 0 = copy settings to cam
}
function SetDefaultSettings(unreal, pCamNr) 
{ 
	CallFunction(unreal, 1, pCamNr); //type 1 = Set default values
}
function SwitchToCam(unreal, pCamNr) 
{ 
	CallFunction(unreal, 2, pCamNr); //type 2 = Switch to cam
}
function SendAllParams(unreal, data) 
{ 
	CallFunction2(unreal, 0, data); //type 0 = send all parameters from master to other Unreal
}



// //====== Send value per type to one Unreal ======
// function SendFloatValue(unreal, camNr, index, value) //camNr, index: integer. value: float
// {
// 	SendValue(unreal, 0, camNr, index, parseFloat(value)); //Value must be a float, NOT a string! (I hate weak typing!)
// }
// function SendBoolValue(unreal, camNr, index, value) //camNr, index: integer. value: true or false
// {
// 	SendValue(unreal, 1, camNr, index, value);
// }
function SendColorValue(unreal, camNr, index, value) //camNr, index: integer. value: RGBA array 0->255
{
//reformat 8-bit RGBA to 0->1 float values with 3 decimals
	var pR=(value[0]/255).toFixed(3)
	  , pG=(value[1]/255).toFixed(3)
	  , pB=(value[2]/255).toFixed(3)
	  , pA=(value[3]/255).toFixed(3); 
//Make color components into object, converted to floats
	SendValue(unreal, 2, camNr, index, {R:parseFloat(pR), G:parseFloat(pG), B:parseFloat(pB), A:parseFloat(pA)}); 
}



//====== Send value per type to all unreals ======
function SendFloatValues(camNr, index, value) //camNr, index: integer. value: float
{
	for(unreal=1;unreal<=numUnreals;unreal++) {
		SendValue(unreal, 0, camNr, index, parseFloat(value)); //Value must be a float, NOT a string! (I hate weak typing!)
	}
}
function SendBoolValues(camNr, index, value) //camNr, index: integer. value: true or false
{
	for(unreal=1;unreal<=numUnreals;unreal++) {
		SendValue(unreal, 1, camNr, index, value);
	}
}
function SendColorValues(camNr, index, value) //camNr, index: integer. value: RGBA array 0->255
{
	for(unreal=1;unreal<=numUnreals;unreal++) {
		SendColorValue(unreal, camNr, index, value);
	}
}


//====== Conditional sync ==============
function SyncAllCamsFromUnreal(unreal)
{
	const um1 = unreal-1;
	if(uActive[um1]) {
		SyncFromUnreal(unreal);
	} else {
		// console.log("Setting status Unreal",unreal,"to NotUsed");
		SetUnrealServerStatus(unreal, NotUsed); //Not active overrides status
	}
}

function CopyMasterToOthers()
{
	console.log("Copying master to others");
	if(masterUnreal>0) {
		if(uStatus[masterUnreal-1]===Online) {
			for(tel=1;tel<=numUnreals;tel++) {
				if(tel!==masterUnreal && uStatus[tel-1]===Online && masterData.Valid) {
					console.log("Copying from",masterUnreal,"to",tel);
					SendAllParams(tel, masterData);
				}
			}
		}
	}
}

//==================================================================================================

// .d8888. d88888b d888888b   db   d8b   db d888888b d8888b.  d888b  d88888b d888888b .d8888. 
// 88'  YP 88'     `~~88~~'   88   I8I   88   `88'   88  `8D 88' Y8b 88'     `~~88~~' 88'  YP 
// `8bo.   88ooooo    88      88   I8I   88    88    88   88 88      88ooooo    88    `8bo.   
//   `Y8b. 88~~~~~    88      Y8   I8I   88    88    88   88 88  ooo 88~~~~~    88      `Y8b. 
// db   8D 88.        88      `8b d8'8b d8'   .88.   88  .8D 88. ~8~ 88.        88    db   8D 
// `8888Y' Y88888P    YP       `8b8' `8d8'  Y888888P Y8888D'  Y888P  Y88888P    YP    `8888Y' 
                                                                                           
//==================================================================================================

//====== Set one slider widget value ======
function SetSliderWidget(camNr,index,value)
{
//Slider label	
	//s_cam1_lbl5
	const output = document.getElementById("s_cam"+camNr+"_lbl"+index);
	if(output) {
		output.innerHTML = ": "+value; //label
//slider thumb position
		//s_cam1_sl6		
		const input = document.getElementById("s_cam"+camNr+"_sl"+index);
		if(input) {
			input.value = value*SlScale;
		}
	}
}

//====== Set one checkbox widget on/off (view alpha, view unkeyed) ======
function SetCheckboxWidget(camNr,index,value)
{
	//Check_Cam1_0
//	$("#Check_Cam"+camNr+"_"+index).netlivaSwitch('state',value);
}

//====== Set one color widget RGB value ======
function SetColorWidget(camNr,index,value)
{
	//Color_Cam1_0
	if(value) {
		const id = "#Color_Cam"+camNr+"_"+index;
		//Convert color components from float 0->1 to integer 0->255
		const R = Math.round(value.R*255);
		const G = Math.round(value.G*255);
		const B = Math.round(value.B*255);
		const rgb = "rgb("+R+","+G+","+B+")";
		//$(id).minicolors('value',rgb);
	}
}

//====== Set all UI widgets from JSON data received from Unreal ======
function SetWidgetsAllCams(unreal, data)
{
	if(unreal===masterUnreal) {
		if(data.Valid) {
			masterData = data;
	//		console.log("Received valid data:",data); 
			//Set the widget values
			for(tel=0;tel<numFloats;tel++) {
				SetSliderWidget(1,tel,data.Floats1[tel]);
				SetSliderWidget(2,tel,data.Floats2[tel]);
				SetSliderWidget(3,tel,data.Floats3[tel]); //TODO: Cam3
			}
			for(tel=0;tel<numBools;tel++) {
				SetCheckboxWidget(1,tel,data.Bools1[tel]);
				SetCheckboxWidget(2,tel,data.Bools2[tel]);
				SetCheckboxWidget(3,tel,data.Bools3[tel]); //TODO: Cam3
			}
			for(tel=0;tel<numColors;tel++) {
				colorUpdate = false; 
				SetColorWidget(1,tel,data.Colors1[tel]);
				colorUpdate = false;
				SetColorWidget(2,tel,data.Colors2[tel]);
				colorUpdate = false;
				SetColorWidget(3,tel,data.Colors3[tel]); //TODO: Cam3
			}
			setTimeout(function() { //Sync with a small delay to allow unreal to execute 
				colorUpdate = true; //otherwise we miss the first color change
			}, 100);
	
		} else {
			console.log("Invalid data received from Unreal");
		}
	}
}

//==================================================================================================

// d888888b d888888b .88b  d88. d88888b d8888b. .d8888. 
// `~~88~~'   `88'   88'YbdP`88 88'     88  `8D 88'  YP 
//    88       88    88  88  88 88ooooo 88oobY' `8bo.   
//    88       88    88  88  88 88~~~~~ 88`8b     `Y8b. 
//    88      .88.   88  88  88 88.     88 `88. db   8D 
//    YP    Y888888P YP  YP  YP Y88888P 88   YD `8888Y' 

//==================================================================================================

function StartPollingTimer(interval)
{
	StopPollingTimer();
	intervalId = setInterval(function() {
		if(isPolling) {
			for(tel=1;tel<=numUnreals;tel++) {
//				console.log("Syncing unreal",tel,"active:",uActive,"Status:",uStatus);
				SyncAllCamsFromUnreal(tel);
			}
		}
	
	}, interval);
}

function StopPollingTimer()
{
	if(intervalId) {
		clearInterval(intervalId);
		intervalId = null;
	}
}

function StartBlinkingTimer()
{
	StopBlinkingTimer();
	blinkingId = setInterval(function() {
	// console.log("Blinking:",BlinkOn);
		for(tel2=1;tel2<=numUnreals;tel2++) {
			SetUnrealServerStatus(tel2, uStatus[tel2-1],true);
		}
		BlinkOn = !BlinkOn;
	}, BlinkTimer);
}

function StopBlinkingTimer()
{
	if(blinkingId) {
		clearInterval(blinkingId);
		blinkingId = null;
	}
}

//===== Returns true if this function was called longer than minInterval millisecs ago. =====
//Unreal processes commands at frame-interval. If you send 'em faster, they will just pile up.
function IsMinInterval()
{
	const now = Date.now();
	const millis = now - startTime;
	const itsOk = millis>minInterval;
	if(itsOk) {
		startTime = now;
	// } else {
	//  	console.log("Skipping update ms=",millis);
	}
	return(itsOk);
}

//====================================================================================================================

// .d8888. d888888b  .d8b.  d888888b db    db .d8888. db   d8b   db d888888b d8888b.  d888b  d88888b d888888b .d8888. 
// 88'  YP `~~88~~' d8' `8b `~~88~~' 88    88 88'  YP 88   I8I   88   `88'   88  `8D 88' Y8b 88'     `~~88~~' 88'  YP 
// `8bo.      88    88ooo88    88    88    88 `8bo.   88   I8I   88    88    88   88 88      88ooooo    88    `8bo.   
//   `Y8b.    88    88~~~88    88    88    88   `Y8b. Y8   I8I   88    88    88   88 88  ooo 88~~~~~    88      `Y8b. 
// db   8D    88    88   88    88    88b  d88 db   8D `8b d8'8b d8'   .88.   88  .8D 88. ~8~ 88.        88    db   8D 
// `8888Y'    YP    YP   YP    YP    ~Y8888P' `8888Y'  `8b8' `8d8'  Y888888P Y8888D'  Y888P  Y88888P    YP    `8888Y' 

//====================================================================================================================

function SetStatusWidget(unreal, text, color)
{
	const obj = document.getElementById("Status"+unreal);
	if(obj) {
		obj.style.backgroundColor = color;
		obj.innerHTML = text;
	}
}

function BlinkStatusWidget(unreal, text, color)
{
	const obj = document.getElementById("Status"+unreal);
	if(obj) {
		if(BlinkOn)
			obj.style.backgroundColor = color;
		else
			obj.style.backgroundColor = "#202020";
		obj.innerHTML = text;
	}
}

function FlashPollingLabel()
{
	const obj = document.getElementById("PollingLabel");
	if(obj) {
		obj.style.backgroundColor = "#0090FF"; //Show blue background for 200ms
		setTimeout(function() { //Sync with a small delay to allow unreal to execute 
			obj.style.backgroundColor = "transparent";
		}, 200);
	}
}





//====== Set unreal status, update status widget & panel covers. ======
//====== Called by response handling, pollTimer and blinkTimer 	 ======
function SetUnrealServerStatus(unreal, status, blink=false)
{
	const um1 = unreal-1;
	if(!uActive[um1]) status = NotUsed; //For late status updates
	uStatus[um1] = status;
	if(status !== oldStatus[um1] || blink) {
		if(!blink) console.log("SetUnrealServerStatus Unreal",unreal,"blink:",blink,"status:",status);
		switch(status) {
		//Not blinking status
		case Unknown:
			SetStatusWidget(unreal,"Unreal"+unreal+": Unknown","grey");
			break;	
		case NotUsed:
			SetStatusWidget(unreal,"Unreal"+unreal+": Not Used","#505050");
			break;	
		case Online:
			SetStatusWidget(unreal,"Unreal"+unreal+": Online","#00A000");
			break; 
		//Blinking status
		case NoUnreal:
			BlinkStatusWidget(unreal,"Unreal"+unreal+": Offline","#D000D0");
			break;
		case NoServer:
			BlinkStatusWidget(unreal,"Unreal"+unreal+": No Server","#B00000");
			break;
		case Refused:
			BlinkStatusWidget(unreal,"Unreal"+unreal+": Refused","#B00000");
			break;
		case TimedOut:
			BlinkStatusWidget(unreal,"Unreal"+unreal+": Not found","#B00000");
			break;
		case BadRequest:
			BlinkStatusWidget(unreal,"Unreal"+unreal+": BadReq","#B00000");
			break;
		case Stopped:
			BlinkStatusWidget(unreal,"Unreal"+unreal+": Stopped","#B0B000");
			break;
		default:break;	
		}

	//Enable the control panels if at least one unreal shows "Online"
		if(!blink) {
			var isOnline = false;
			for(tel=0;tel<numUnreals;tel++) {
				if(uActive[tel] && uStatus[tel]===Online) isOnline = true;
			}
	//		console.log("IsOnline unreal"+unreal,"is",isOnline);
			for(tel=1;tel<=numCams;tel++) {
				const cover = document.getElementById("Cover"+tel);
				if(cover) { //Hide cover if unreal online to enable widget use
//					cover.style.display = isOnline?"none":"block"; 
					if(tel===1) cover.style.display = isOnline?"none":"none"; 
				}
			}
			oldStatus[um1] = status;
		}
	}
}

//==================================================================================================

// db   db d88888b db      d8888b. 
// 88   88 88'     88      88  `8D 
// 88ooo88 88ooooo 88      88oodD' 
// 88~~~88 88~~~~~ 88      88~~~   
// 88   88 88.     88booo. 88      
// YP   YP Y88888P Y88888P 88      
                                
//==================================================================================================

const theHelpFile = <>
	<b>Master Unreal:</b> This Unreal returns values to the panel.<br/>
	<b>Copy master to Others:</b> Copies all settings from the Master Unreal to all other online unreal engines.<br/>
	<b>Poll status:</b> Highlights when updating status and values.<br/>
	<b>1/2/3 On/Off:</b> Enable or disable an Unreal engine.<br/>
	<br/>
	<span style={{color:'blue'}}><b><u>Chromakey settings:</u></b></span><br/>
	<b>Chroma Minimum:</b> Background clip level.<br/>
	<b>Chroma Gain:</b> Foreground tolerance.<br/>
	<b>Alpha Bias:</b> Balance between back-/foreground key<br/>
	<b>Luma Log Minimum:</b> Background clip level curve.<br/>
	<b>Luma Log Gain:</b> Foreground tolerance curve.<br/>
	<b>Black Clip:</b> Hard cut-off alpha black (background)<br/>
	<b>White Clip:</b> Hard cut-off alpha white (foreground)<br/>
	<b>Devignette Inner:</b> Lens vignette compensation edge<br/>
	<b>Devignette Outer:</b> Lens vignette compensation edge<br/>
	<b>Devignette Amount:</b> Lens vignette strength<br/>
	<b>Preblur strength:</b> Edge softening amount<br/>
	<b>Preblur Samples:</b> Edge softening quality<br/>
	<b>Key Color:</b> Background color to key out<br/>
	<b>Alpha off:</b> Shows/hides the chromakey alpha signal.<br/>
	Useful to check background/foreground clarity.<br/>
	<b>Keyed fill:</b> Shows the fill signal without/with key.<br/>
	Useful to set green removal. (Despill Amount)<br/>
	<b>View Cam 1/2:</b> Switch Unreal to this camera.<br/>
	<br/>
	<span style={{color:'blue'}}><b><u>Despill / post processor settings:</u></b><br/></span>
	<b>Despill Amount:</b> neutralizing keycolor amount in fill<br/>
	<b>Hue Range:</b> Range of keycolor neutralizing in fill<br/>
	<b>Fill Gain:</b> Fill signal white level<br/>
	<b>Fill Pedestal:</b> Fill signal black level<br/>
	<b>Fill Gamma:</b> Fill signal curve<br/>
	<b>Fill Saturation:</b> Fill signal chrominance (can invert color)<br/>
	<b>Sky Amount:</b> Additive hue shift amount. Tip: Decrease Fill Gain when adding sky color.<br/>
	<b>Sky Color:</b> Additive hue shift tint. (Use saturated colors)<br/>
	<br/><b>Copy from CAM 1/2:</b> Copy all settings from the other camera to this camera.<br/>
	<b>Default values:</b> Reset all settings to the Unreal defaults.<br/>
	<br/>
	<span style={{color:'red'}}><b>Warning:</b> The copy/default buttons overwrite all settings.</span><br/>
	<br/>Click <b>HELP</b> again to hide.
</>

function ShowHelp() {
	document.getElementById("help_Popup").classList.toggle("show");
}

//==========================================================================================================================

// d888888b  .d88b.  d8888b.     d8888b.  .d8b.  d8b   db d88888b db      
// `~~88~~' .8P  Y8. 88  `8D     88  `8D d8' `8b 888o  88 88'     88      
//    88    88    88 88oodD'     88oodD' 88ooo88 88V8o 88 88ooooo 88      
//    88    88    88 88~~~       88~~~   88~~~88 88 V8o88 88~~~~~ 88      
//    88    `8b  d8' 88          88      88   88 88  V888 88.     88booo. 
//    YP     `Y88P'  88          88      YP   YP VP   V8P Y88888P Y88888P 
                                                                       
//==========================================================================================================================


function TopPanel(props) {
	//This code is called on initialisation of the component
	useEffect(() => {
		console.log("==> Initializing top panel...");
		document.getElementById("Check2_box").style.visibility = numUnreals>=2 ? 'visible' : 'hidden';
		document.getElementById("Check3_box").style.visibility = numUnreals>=3 ? 'visible' : 'hidden';
		document.getElementById("Master2_box").style.visibility = numUnreals>=2 ? 'visible' : 'hidden';
		document.getElementById("Master3_box").style.visibility = numUnreals>=3 ? 'visible' : 'hidden';
//Set initial status widgets to unknown status
		for(tel=0;tel<numUnreals;tel++) {
			SetUnrealServerStatus(tel+1, Unknown);
		}
	}, []);

	//Buttons pressed
	let [theButton, setTheButton] = useState(-1); //Which button pressed? (0->n)
	useEffect(() => {
		if(theButton>=0) console.log(`Button ${theButton} pressed.`);
		switch(theButton) {
			case 0:
				CopyMasterToOthers();
				break;
			case 1:
				ShowHelp();
				break;
			default: break;	
		}
		setTheButton(-1); //Reset state to nothing, So we can press the same button again
	}, [theButton]);

	//Set master unreal state as an array of states. Note: We cannot use dereferenced arrays here!
	let MasterStates = [useState(true), useState(false), useState(false)];
	const onMasterChanged = (idStr, checked) => {
		const unreal = parseInt(idStr.slice(8)); //Master_U1
		//console.log("Master id:",idStr,"unreal:",unreal,"checked:",checked); 
		SetMaster(unreal,true); //Set to "true" to disallow unchecking the checked button. Set to "checked" to allow unchecking.
	};
	//setMaster turns togglebuttons into radio-togglebuttons: Checking one unchecks all others
	//This function is also called in the "Master logic" when enabling/disabling unreals
	function SetMaster(unreal,checked) {
		MasterStates[unreal-1][0] = checked; 
		for(tel=0;tel<numUnreals;tel++) {
			MasterStates[tel][1](unreal===(tel+1) ? checked : false); //call setState functions for all togglebuttons in the group
		}
		masterUnreal = unreal;
		console.log("Setting master to:",masterUnreal);
		//Read & update from the new MasterUnreal
		SyncAllCamsFromUnreal(masterUnreal);
	};
	
	//Enable/disable an unreal state
	let UnrealStates = [useState(uActive[0]), useState(uActive[1]), useState(uActive[2])];
	const onUnrealToggleChanged = (idStr, checked) => {
		const unreal = parseInt(idStr.slice(7)); //Check_U1
		console.log("Check id:",idStr,"unreal:",unreal,"checked:",checked); 
		const um1 = unreal-1;
		uActive[um1] = checked;
		UnrealStates[um1][1](checked);
		//Master unreal logic, to ensure the master is always an active unreal.
		if(checked && (masterUnreal===0 || (masterUnreal>0 && !uActive[masterUnreal-1]))) { //Set this as master
			SetMaster(unreal,true);
		}
		if(!checked && unreal===masterUnreal) { //Find another master
			var utel; for(utel=1;utel<=numUnreals;utel++) {
				if(uActive[utel-1]) {
					SetMaster(utel,true);
					break;
				}
			}
		}
	};

//	Warning: Using a module instead of inline code breaks animation in the ToggleSwitch widget
//	Called as: <MasterWidget unreal="1" /> in JSX
	// function MasterWidget(param) {
	// 	const uStr = param.unreal;
	// 	const UuStr = "U"+uStr;
	// 	const um1 = parseInt(uStr) - 1;
	// 	return (
	// 		<div className="Unreals" id={"Master"+uStr+"_box"}>
	// 			<ToggleSwitch id={"Master_U"+uStr} checked={MasterStates[um1][0]} onChange={onMasterChanged} optionLabels={[UuStr,uStr]} />
	// 		</div>
	// 	);
	// } 

	return (
		<>
			<div className="TopPanel">
				<label id="TitleLabel">Unreal Chromakey Control Panel</label>
				<div className="MasterSelect">
					<label className="MasterLabel">Master Unreal:</label>
					{/* <MasterWidget unreal="1" />
					<MasterWidget unreal="2" />
					<MasterWidget unreal="3" /> */}
					<div className="Unreals" id="Master1_box">
						<ToggleSwitch id="Master_U1" checked={MasterStates[0][0]} onChange={onMasterChanged} optionLabels={["U1","1"]} />
					</div>
					<div className="Unreals" id="Master2_box">
						<ToggleSwitch id="Master_U2" checked={MasterStates[1][0]} onChange={onMasterChanged} optionLabels={["U2","2"]} />
					</div>	
					<div className="Unreals" id="Master3_box">
						<ToggleSwitch id="Master_U3" checked={MasterStates[2][0]} onChange={onMasterChanged} optionLabels={["U3","3"]} />
					</div>
					<button id="But0" className="button button1" onClick={() => setTheButton(0)}>Copy Master to Others</button>
				</div>
				<div className="popup">
					<button id="But1" className="button button1" onClick={() => setTheButton(1)}>H E L P</button>
					<span className="popuptext" id="help_Popup">{theHelpFile}</span>
				</div>	

				<div className="UnrealBlock">
					<label id="PollingLabel">Poll&nbsp;Status</label>
					<div className="Unreals" id="Check1_box">
						<ToggleSwitch id="Check_U1" checked={UnrealStates[0][0]} onChange={onUnrealToggleChanged} optionLabels={["1 On","1 Off"]}/>
						<label className="UnrealStatus" id="Status1">Unreal1: Unknown</label>
					</div>	
					<div className="Unreals" id="Check2_box">
						<ToggleSwitch id="Check_U2"	checked={UnrealStates[1][0]} onChange={onUnrealToggleChanged} optionLabels={["2 On","2 Off"]}/>
						<label className="UnrealStatus" id="Status2">Unreal2: Unknown</label>
					</div>	
					<div className="Unreals" id="Check3_box">
						<ToggleSwitch id="Check_U3"	checked={UnrealStates[2][0]} onChange={onUnrealToggleChanged} optionLabels={["3 On","3 Off"]}/>
						<label className="UnrealStatus" id="Status3">Unreal3: Unknown</label>
					</div>	
				</div>
			</div>
		</>
	);
}

//==========================================================================================================================

// .d8888. db      d888888b d8888b. d88888b d8888b. 
// 88'  YP 88        `88'   88  `8D 88'     88  `8D 
// `8bo.   88         88    88   88 88ooooo 88oobY' 
//   `Y8b. 88         88    88   88 88~~~~~ 88`8b   
// db   8D 88booo.   .88.   88  .8D 88.     88 `88. 
// `8888Y' Y88888P Y888888P Y8888D' Y88888P 88   YD 
                                                                                                  
//==========================================================================================================================


//One slider with parameters
function Slider(props) {
	const cam = props.camN;			//Camera nr
	const idx = props.index;			//Index number in unreal float array order
	const min = parseInt(props.min);	//Real minimum value (integer)
	const minSc= min * SlScale; 		//minimum in slider range
	const max  = parseInt(props.max);	//real maximum value (integer)
	const maxSc= max * SlScale;			//maximum in slider range
	const step = parseFloat(props.step);	//Real step value (float!)
	const style={"--step":step, "--min":min, "--max":max, "--default":0, "--width":99}; //The style object
	const s_IdStr = "s_cam"+cam+"_sl"+idx;	//Compose Id of this slider to get the object
	const s_IdStrL= "s_cam"+cam+"_lbl"+idx;	//Compose Id of the label to show the value


	useEffect(() => {
		console.log("Init slider",s_IdStr);
		const slidr = document.getElementById(s_IdStr);
		const output= document.getElementById(s_IdStrL);
		output.innerHTML=": 0";	//Slider label init
		slidr.value = "0";
		// console.log("Slider:",idStr,camNr,index);
		slidr.oninput = function() {
			if(IsMinInterval()) { //Regulate sending interval to max 1 per 20ms interval
				const value = parseFloat(slidr.value);
				const realVal = value / SlScale;
				output.innerHTML = ": "+realVal;
				console.log("Onslider id=",s_IdStr,"value=",realVal);
				SendFloatValues(parseInt(cam), parseInt(idx), realVal.toFixed(3));
				isPolling = false; //Disable while sliding
			}
		}; 
		slidr.onmouseover = function() {
			// isPolling = false;
		};
		slidr.onmouseout = function() {
			isPolling = true;
		};
	}, [s_IdStr,s_IdStrL,cam,idx]);

	return (
		<>
			<label className="LabelText">{props.title}</label>
			<label className="LabelValue" id={s_IdStrL}>: 0</label>
			<div className="range" style={style}>
				<input 
					//Do NOT pass a value here. This makes the component "controlled" and blocks slider movement
					type="range" 
					className="slider" 
					min={minSc} 
					max={maxSc}
					step="1"
					id={s_IdStr}
				/>
			</div>
		</>
	);
}

//==========================================================================================================================

//  .o88b.  .d8b.  .88b  d88.     d8888b.  .d8b.  d8b   db d88888b db      
// d8P  Y8 d8' `8b 88'YbdP`88     88  `8D d8' `8b 888o  88 88'     88      
// 8P      88ooo88 88  88  88     88oodD' 88ooo88 88V8o 88 88ooooo 88      
// 8b      88~~~88 88  88  88     88~~~   88~~~88 88 V8o88 88~~~~~ 88      
// Y8b  d8 88   88 88  88  88     88      88   88 88  V888 88.     88booo. 
//  `Y88P' YP   YP YP  YP  YP     88      YP   YP VP   V8P Y88888P Y88888P 

//==========================================================================================================================

//Main panel for one camera
function CamPanel(props) {
	const cam = props.camIndex;	//string
	const iCam = parseInt(cam);	//integer
	const idStrA = "Check_Cam"+cam+"_A";	//Compose id of show alpha switch
	const idStrF = "Check_Cam"+cam+"_F";	//Compose id of show unkeyed fill switch
	var	credits; 		//Different credits per panel
	var	otherCam = "1";	//the "master" camera to copy settings from (unreal knows this)
	if(cam==="1")	{
		credits = <label id="Credits">node.js Server & REACT Webtool by Chris Van den Bossche</label>;
		otherCam = "2";
	} else {
		credits = <label id="Credits">© 2022 VRT ELAN</label>;
	}

	//This code is called on initialisation of the component
	useEffect(() => {
		console.log("==> Initializing CAM"+cam+" panel...");

		//Camera panel width, position, visibility
		const thePanel = document.getElementById("CamPanel"+cam);
		switch(numCams) { //all panels width
			case 1:
				thePanel.style.width = '98%';
				break;
			case 2:
				thePanel.style.width = '48%';
				break;
			case 3:
				thePanel.style.width = '32%';
				break;
			default: break;	
		}
		switch(iCam) {
			case 1:
				thePanel.style.left = '0%';
				break;
			case 2:
				thePanel.style.left = numCams===3 ? '33%' : '50%';
				thePanel.style.visibility = numCams>1 ? 'visible' : 'hidden';
				break;
			case 3:
				thePanel.style.left = '66%';
				thePanel.style.visibility = numCams===3 ? 'visible' : 'hidden';
				break;
			default: break;	
		}
	}, [cam, iCam]);

	//Callback for buttons pressed
	let [theButton, setTheButton] = useState(-1); //Which button pressed? (0->n)
	useEffect(() => {
		if(theButton>=0) console.log(`Button ${theButton} pressed.`);
//Do for all unreals	
			for(unreal=1;unreal<=numUnreals;unreal++) {
				switch(theButton) {
				case 0:
					SwitchToCam(unreal,iCam);
					console.log("U",unreal,"Show cam",cam);
					break;
				case 1:
					console.log("U",unreal,"Copy from cam",otherCam);
					CopyCamSettingsTo(unreal,iCam);
					break;
				case 2:
					console.log("U",unreal,"Defaults cam",cam);
					SetDefaultSettings(unreal,iCam);
					break;
				default: break;	
			}
		}
		setTheButton(-1); //Reset state to nothing, So we can press the same button again
	}, [theButton, cam, iCam, otherCam]);

	//Enable/disable a chromakey option
	let[alphaState,setAlphaState] = useState(false);//show alpha
	let[fillState,setFillState] = useState(false);	//show unkeyed fill	
	const onKeyToggleChanged = (idStr, checked) => {
		console.log("Switch",idStr,"is",checked);
		if(idStr.slice(11)==="A") { //alpha: Check_Cam1_A
			alphaState = checked;
			setAlphaState(checked);
			SendBoolValues(iCam, 0, checked);
		}
		if(idStr.slice(11)==="F") { //fill: Check_Cam2_F
			fillState = checked;
			setFillState(checked);
			SendBoolValues(iCam, 1, checked);
		}
	};

	return (
		<div className="MainPanel" id={"CamPanel"+cam}>
			<h3 className="CamHdr">{"CAM "+cam+": Chromakey"}</h3>
			<div className="sliderGroup">
				<Slider camN={cam} title="Chroma Minimum" 		index="5"	min="0" max="1" step="0.1" />
				<Slider camN={cam} title="Chroma Gain" 			index="6"	min="0" max="8" step="0.5" />
				<Slider camN={cam} title="Alpha Bias" 			index="9"	min="0" max="1" step="0.1" />
				<Slider camN={cam} title="Luma Log Minimum" 	index="10"	min="0" max="5" step="0.5" />
				<Slider camN={cam} title="Luma Log Gain" 		index="11"	min="0" max="4" step="0.4" />
				<Slider camN={cam} title="Black Clip" 			index="7"	min="0" max="100" step="10" />
				<Slider camN={cam} title="White Clip" 			index="8"	min="0" max="100" step="10" />
				<Slider camN={cam} title="Devignette Inner"		index="2"	min="-1" max="1" step="0.1" />
				<Slider camN={cam} title="Devignette Outer"		index="3"	min="0" max="2" step="0.1" />
				<Slider camN={cam} title="Devignette Amount"	index="4"	min="0" max="2" step="0.1" />
				<Slider camN={cam} title="Preblur Strength"		index="0"	min="0" max="8" step="1" />
				<Slider camN={cam} title="Preblur Samples"		index="1"	min="1" max="32" step="3" />
				<div className="colorGroup">
					<div className="inlineGroup">
						<label className="LabelText" htmlFor="ColorWheel">Key<br/>Color:</label>

					</div>	
					<div className="inlineGroup">
						<label className="LabelText" htmlFor="ColorWheel">Show<br/>Alpha:</label>
						<ToggleSwitch id={idStrA} checked={alphaState} onChange={onKeyToggleChanged} optionLabels={["On","Off"]}/>
					</div>
					<div className="inlineGroup">
						<label className="LabelText" htmlFor="ColorWheel">Show Unkeyed<br/>Fill :</label>
						<ToggleSwitch id={idStrF} checked= {fillState} onChange={onKeyToggleChanged} optionLabels={["On","Off"]}/>
					</div>
					<button id={"View_Cam"+cam}  className="button button1" onClick={() => setTheButton(0)}>{"View CAM "+cam}</button>
				</div>
			</div>
			<hr style={{"height":"6px", "borderWidth":"1px", "borderColor":"black", "backgroundColor":"#020"}}/>
			<h3 className="CamHdr">{"CAM "+cam+": Despill & Post process"}</h3>
			<div className="sliderGroup">
				<Slider camN={cam} title="Despill Amount" 		index="16"	min="0" max="2" step="0.1" />
				<Slider camN={cam} title="Hue Range" 			index="17"	min="0" max="1" step="0.1" />
				<Slider camN={cam} title="Fill Gain" 			index="18"	min="0" max="2" step="0.1" />
				<Slider camN={cam} title="Fill Pedestal"		index="19"	min="-2" max="2" step="0.2" />
				<Slider camN={cam} title="Fill Gamma" 			index="20"	min="0" max="2" step="0.1" />
				<Slider camN={cam} title="Fill Saturation"		index="21"	min="-1" max="2" step="0.2" />
				<Slider camN={cam} title="Sky Amount" 			index="22"	min="0" max="1" step="0.1" />
				<div className="colorGroup">
					<div className="inlineGroup">
						<label className="LabelText" htmlFor="ColorWheel">Sky Color:</label>

					</div>	
					<button id={"CopyFrom_Cam"+cam}  className="button button1" onClick={() => setTheButton(1)}>{"Copy From CAM "+otherCam}</button>
					<button id={"Default_Cam"+cam}   className="button button1" onClick={() => setTheButton(2)}>Default values</button>
				</div>
				<div className="CoverPanel" id={"Cover"+cam}></div>
			</div>
			{credits}
		</div>
	);
}

function ThePanel(props) {
  	return (
		<>
			<TopPanel />
			<CamPanel camIndex="1"/>
			<CamPanel camIndex="2"/>
			<CamPanel camIndex="3"/>
		</>
  	);
}

export default ThePanel;
