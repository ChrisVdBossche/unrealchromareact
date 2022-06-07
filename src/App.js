import React, {useState, useEffect} from "react";
import './App.css';
import './Buttons.css';
import './Sliders.css';
import ToggleSwitch from './ToggleSwitch/ToggleSwitch';

//==================================================================================================

//  d888b  db       .d88b.  d8888b.  .d8b.  db      .d8888. 
// 88' Y8b 88      .8P  Y8. 88  `8D d8' `8b 88      88'  YP 
// 88      88      88    88 88oooY' 88ooo88 88      `8bo.   
// 88  ooo 88      88    88 88~~~b. 88~~~88 88        `Y8b. 
// 88. ~8~ 88booo. `8b  d8' 88   8D 88   88 88booo. db   8D 
//  Y888P  Y88888P  `Y88P'  Y8888P' YP   YP Y88888P `8888Y' 

//==================================================================================================
                                                       
//TODO: How many unreal servers can be used?
const numUnreals = 2;
//TODO: How many cameras in use for each unreal server? (1,2,3)
const numCams = 2;

var uStatus = new Array(numUnreals);	//unreal status
var oldStatus = new Array(numUnreals);	//To avoid unneeded, blink-disturbing update of status widgets
var uActive = new Array(numUnreals);	//unreal active or not
var masterUnreal = 0; //No unreal as master yet
var masterData;		//Remember data from master, to send to other unreals
//Node.js server that translates unreal commands
const nodeServerIP = "localhost";
const nodeServerPort = 8800;

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

//==================================================================================================
//====== Initializing Globals ======
var utel;
for(utel=0;utel<numUnreals;utel++) {
	uStatus[utel] =  Unknown;
	uActive[utel] =  false;
}

//===== Initially activate an Unreal ==========
uActive[0] = true;	//server 1 active on startup
//uActive[1] = true;	//server 2 active on startup
//uActive[2] = true;	//server 3 active on startup

//===== Initialize client panel ===============
onInit();

//==================================================================================================

// d888888b d8b   db d888888b d888888b d888888b  .d8b.  db      d888888b .d8888. d88888b 
//   `88'   888o  88   `88'   `~~88~~'   `88'   d8' `8b 88        `88'   88'  YP 88'     
//    88    88V8o 88    88       88       88    88ooo88 88         88    `8bo.   88ooooo 
//    88    88 V8o88    88       88       88    88~~~88 88         88      `Y8b. 88~~~~~ 
//   .88.   88  V888   .88.      88      .88.   88   88 88booo.   .88.   db   8D 88.     
// Y888888P VP   V8P Y888888P    YP    Y888888P YP   YP Y88888P Y888888P `8888Y' Y88888P 

//==================================================================================================

//====== Initialisations, called at startup/reload client ======
function onInit() { 
	console.log("Initializing...");
//	console.log("This node.js Server: HostName =",location.hostname,", PortNr =",location.port); //Does not work in react!

//TODO: Init minicolors

	//Camera panel width, positions, visibility
	const panels = document.getElementsByClassName("MainPanel");
	for(var i = 0; i < panels.length; i++) {
		switch(numCams) { //all panels width
			case 1:
				panels[i].style.width = '98%';
				break;
			case 2:
				panels[i].style.width = '48%';
				break;
			case 3:
				panels[i].style.width = '32%';
				break;
			default: break;	
		}
		if(i===1) { //panel 2 position & visibility
			panels[i].style.left = numCams===3 ? '33%' : '50%';
			panels[i].style.visibility = numCams>1 ? 'visible' : 'hidden';
		}
		if(i===2) { //panel 3 visibility
			panels[i].style.visibility = numCams===3 ? 'visible' : 'hidden';
		}
	}


	//init callbacks
// //callback declarations MUST be done at end of html 
// 	var sliders = document.getElementsByClassName("slider");
// 	for (var i = 0; i < sliders.length; i++) {
// 		const slidr = sliders[i];
// 		const idStr = slidr.id; //"s_cam1_sl16"
// 		const index = parseInt(idStr.slice(9)); 	//Get index nr
// 		const camNr = parseInt(idStr.slice(5,6)); 	//Get camera nr
// 	//console.log("Slider:",idStr,camNr,index);
// 		slidr.oninput = function() {onSlider(camNr,index,slidr)};
// 		slidr.onmouseover = function() {on_S_MouseOver() };
// 		slidr.onmouseout = function() {on_S_MouseOut() };
// 	}

	//TODO
	console.log("Done Initializing.");
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
//console.log("SetUnrealServerStatus Unreal",unreal,"status:",status);
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
		default: break;	
		}

	//Enable the control panels if at least one unreal shows "Online"
		if(!blink) {
			var isOnline = false;
			var tel;
			for(tel=0;tel<numUnreals;tel++) {
				if(uActive[tel] && uStatus[tel]===Online) isOnline = true;
			}
	//		console.log("IsOnline unreal"+unreal,"is",isOnline);
			for(tel=1;tel<=numCams;tel++) {
				const cover = document.getElementById("Cover"+tel);
				if(cover) { //Hide cover if unreal online to enable widget use
					cover.style.display = isOnline?"none":"block"; 
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



//=====================================================================================================

function TopPanel() {
	//Buttons pressed
	let [theButton, setTheButton] = useState(-1); //Which button pressed? (0->n)
	useEffect(() => {
		if(theButton>=0) console.log(`Button ${theButton} pressed.`);
		switch(theButton) {
			case 0:
				//CopyMasterToOthers();
				break;
			case 14:
				ShowHelp();
				break;
			default: break;	
		}
		setTheButton(-1); //Reset state to nothing, So we can press the same button again
	}, [theButton]);

	useEffect(() => {
//		console.log("Setting checks and Masters");
		document.getElementById("Check2_box").style.visibility = numUnreals>=2 ? 'visible' : 'hidden';
		document.getElementById("Check3_box").style.visibility = numUnreals>=3 ? 'visible' : 'hidden';
		document.getElementById("Master2_box").style.visibility = numUnreals>=2 ? 'visible' : 'hidden';
		document.getElementById("Master3_box").style.visibility = numUnreals>=3 ? 'visible' : 'hidden';
	}, []);

	//This turns checkboxes into radio buttons: Checking one unchecks all others
	function SetMaster(unreal,checked) {
		var utel; for(utel=0;utel<numUnreals;utel++) {
			MasterStates[utel][1](unreal===(utel+1) ? checked : false);
		}
		masterUnreal = unreal;
		console.log("Setting master to:",unreal);
		//TODO: Read & update from Unreal

	};

	//Set master unreal state as an array of states. Note: No dereferenced arrays here!
	let MasterStates = [useState(true), useState(false), useState(false)];
	const onMasterChanged = (idStr, checked) => {
		const unreal = parseInt(idStr.slice(8)); //Master_U1
		console.log("Master id:",idStr,"unreal:",unreal,"checked:",checked); 
		SetMaster(unreal,true); //Do not allow to uncheck the checked box
	};

	//Enable/disable an unreal state
	let UnrealStates = [useState(uActive[0]), useState(uActive[1]), useState(uActive[2])];
	const onUnrealToggleChanged = (idStr, checked) => {
		const unreal = parseInt(idStr.slice(7)); //Check_U1
		console.log("Check id:",idStr,"unreal:",unreal,"checked:",checked); 
		const um1 = unreal-1;
		uActive[um1] = checked;
			UnrealStates[unreal-1][1](checked);
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

	//This breaks the checkbox widget
	//Called as: <MasterWidget unreal="1" /> in JSX
	// function MasterWidget(param) {
	// 	const uStr = param.unreal;
	// 	const UuStr = "U"+uStr;
	// 	const unreal = parseInt(uStr);
	// 	return (
	// 		<div className="Unreals" id={"Master"+uStr+"_box"}>
	// 			<ToggleSwitch id={"Master_U"+uStr} checked={MasterStates[unreal-1][0]} onChange={onMasterChanged} optionLabels={[UuStr,uStr]} />
	// 		</div>
	// 	);
	// } 

	return (
		<>
			<div className="TopPanel">
				<label id="TitleLabel">Unreal Chromakey Control Panel</label>
				<div className="MasterSelect">
					<label className="MasterLabel">Master Unreal:</label>
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
					<button id="But14" className="button button1" onClick={() => setTheButton(14)}>H E L P</button>
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

//One slider with parameters
function Slider(params) {
	const cam = params.camN;			//Camera nr
	const idx = params.index;			//Index number in unreal float array order
	const min = parseInt(params.min);	//Real minimum value (integer)
	const minSc= min * SlScale; 		//minimum in slider range
	const max  = parseInt(params.max);	//real maximum value (integer)
	const maxSc= max * SlScale;			//maximum in slider range
	const step = parseFloat(params.step);	//Real step value (float!)
	const style={"--step":step, "--min":min, "--max":max, "--default":0, "--width":99}; //The style object
	const idStr = "s_cam"+cam+"_sl"+idx;	//Compose Id of this slider to get the object
	const idStrL= "s_cam"+cam+"_lbl"+idx;	//Compose Id of the label to show the value

	useEffect(() => {
		console.log("Init slider",idStr);
		const slidr = document.getElementById(idStr);
		const output= document.getElementById(idStrL);
		output.innerHTML=": 0";	//Slider label init
		slidr.value = "0";
		// console.log("Slider:",idStr,camNr,index);
		slidr.oninput = function() {
			if(IsMinInterval()) { //Regulate sending interval to max 1 per 20ms interval
				const value = slidr.value;
				const realVal = value/SlScale;
				output.innerHTML = ": "+realVal;
				console.log("Onslider id=",idStr,"value=",realVal);
				SendFloatValues(cam, idx, realVal.toFixed(3));
				isPolling = false; //Disable while sliding
			}
		}; 
		slidr.onmouseover = function() {
			// isPolling = false;
		};
		slidr.onmouseout = function() {
			isPolling = true;
		};
	}, [idStr,idStrL,cam,idx]);

	return (
		<>
			<label className="LabelText">{params.title}</label>
			<label className="LabelValue" id={"s_cam"+cam+"_lbl"+idx}>: 0</label>
			<div className="range" style={style}>
				<input 
					//Do NOT pass a value here. This makes the component "controlled" and blocks slider movement
					type="range" 
					className="slider" 
					min={minSc} 
					max={maxSc}
					step="1"
					id={idStr}
				/>
			</div>
		</>
	);
}

//Main panel for one camera
function CamPanel(params) {
	const cam = params.camIndex;
	var credits; //Cannot use a const here
	if(cam==="1")	credits = <label id="Credits">node.js & REACT Webtool by Chris Van den Bossche</label>;
	else			credits = <label id="Credits">© 2022 VRT ELAN</label>;
	return (
		<div className="MainPanel" id={"CamPanel"+cam}>
			<h3 className="CamHdr">{"CAM "+cam+": Chromakey"}</h3>
			<div className="sliderGroup">
				<Slider camN={cam} title="Chroma Minimum" 	index="5"	min="0" max="1" step="0.1" />
				<Slider camN={cam} title="Chroma Gain" 		index="6"	min="0" max="8" step="0.5" />
				<Slider camN={cam} title="Alpha Bias" 		index="9"	min="0" max="1" step="0.1" />
			</div>
			{credits}
		</div>
	);
}

function ThePanel() {
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
