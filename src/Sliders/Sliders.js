import React, {useEffect, useRef} from "react";
import './Sliders.css';

//Component for a slider with label, value indicator, groupnr and indexnr.
//props:
//	"title": Text in the label
//	"group", "index": Integer numbers to group multiple sliders. These are returned in onSlide(group,index,value)
//	"min", "max": Lower & upper limits of output value
//	"step": Divisions in the slider bar
//Callbacks:
//	onSlide: Called when slider is moved
//	onPoll:  Called when slider is moved (false) and released (true) to enable/disable polling or to send values on release only

//Slider scale factor. To reduce output values to any float range (like 0->1.0) while retaining sufficient slider resolution
const SlScale = 1000.0;

//====== Set one slider widget value ======
export function SetSlider(group,index,value)
{
//Slider label (we cannot use the ref here, so we need the ID)
	//s_grp1_lbl5
	const lbl = document.getElementById("s_grp"+group+"_lbl"+index);
	if(lbl) {
		lbl.innerHTML = " "+value; //label
	}
//slider thumb position
	//s_grp1_sl6		
	const slidr = document.getElementById("s_grp"+group+"_sl"+index);
	if(slidr) {
		slidr.value = value * SlScale;
	}
}

//One slider with parameters
export function Slider(props) {
	const title = props.title;			//Title of the slider
	const grp = props.group;			//Group (Camera) nr
	const idx = props.index;			//Index number (in Unreal float array order)
	const min = parseInt(props.min);	//Real minimum value (integer)
	const minSc= min * SlScale; 		//minimum in slider range
	const max  = parseInt(props.max);	//real maximum value (integer)
	const maxSc= max * SlScale;			//maximum in slider range
	const step = parseFloat(props.step);	//tick steps in real value (float!)
	const style={"--step":step, "--min":min, "--max":max, "--default":0, "--width":99}; //The style object for CSS
	const s_IdStr = "s_grp"+grp+"_sl"+idx;	//Compose Id of this slider & label to get the objects in SetSlider
	const s_IdStrL= "s_grp"+grp+"_lbl"+idx;	
	//callbacks
	const onSlide = props.onSlide;
	const onPoll = props.onPoll;
	//references
	const sliderRef = useRef(null);
	const labelRef = useRef(null);

	useEffect(() => {
		console.log("==> Init slider group"+grp,"nr",idx);
		//Get the object by its reference (there is no "this" in functional components)
		const lbl = labelRef.current;
		lbl.innerHTML=" 0";	//Slider label init
		const slidr = sliderRef.current;
		slidr.value = "0";	//slider position init
		// console.log("Slider:",idStr,camNr,index);
		slidr.oninput = function() {
			const value = parseFloat(slidr.value);
			const realVal = value / SlScale;
			lbl.innerHTML = " "+realVal;
			onPoll(false);	//Disable polling while sliding
			onSlide(parseInt(grp), parseInt(idx), realVal.toFixed(3));	//Return integers and decimal-limited float
		}; 
		// slidr.onmouseover = function() { } //obsolete
		slidr.onmouseout = function() {
			onPoll(true); //Re-enable polling on mouse-out
		};
// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sliderRef,labelRef,grp,idx]); //Including onSlide and onPoll triggers an unwanted init on buttons etc, so we disable the warning.

	return (
		<>
			<label className="LabelText">{title+":"}</label>
			<label className="LabelValue" ref={labelRef} id={s_IdStrL}/>
			<div className="range" style={style}>
				<input 
					//Do NOT pass a default value here. This makes the component "controlled" and blocks slider movement
					type="range" 
					className="slider" 
					min={minSc} 
					max={maxSc}
					step="1"
					ref={sliderRef}
					id={s_IdStr}
				/>
			</div>
		</>
	);
}
