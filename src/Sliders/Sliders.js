import React, {useEffect} from "react";
import './Sliders.css';

//Slider scale factor
const SlScale = 1000.0;

//====== Set one slider widget value ======
export function SetSlider(camNr,index,value)
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
			input.value = value * SlScale;
		}
	}
}

//One slider with parameters
export function Slider(props) {
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
	var onSlide = props.onSl;
	var onPoll = props.onP;

	// function onSl(cam,idx,value) { props.onSl(cam,idx,value);};
	// function onP(val) { props.onP(val);};

	useEffect(() => {
		console.log("==> Init slider CAM"+cam,"nr",idx);
		const slidr = document.getElementById(s_IdStr);
		const output= document.getElementById(s_IdStrL);
		output.innerHTML=": 0";	//Slider label init
		slidr.value = "0";
		// console.log("Slider:",idStr,camNr,index);
		slidr.oninput = function() {
			const value = parseFloat(slidr.value);
			const realVal = value / SlScale;
			output.innerHTML = ": "+realVal;
			onPoll(false);	//Disable while sliding
			onSlide(parseInt(cam), parseInt(idx), realVal.toFixed(3));	
		}; 
		// slidr.onmouseover = function() { } //obsolete
		slidr.onmouseout = function() {
			onPoll(true);
		};
// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [s_IdStr,s_IdStrL,cam,idx]); //Including onSlide and onPoll triggers an unwanted in it on buttons etc, so we disable the warning.


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
