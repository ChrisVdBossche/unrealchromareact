import React, {useState} from "react";
import './App.css';
import './Buttons.css';
import ToggleSwitch from './ToggleSwitch/ToggleSwitch'

function MasterSelect() {
	let [Master_U1, setMaster_U1] = useState(true);
	let [Master_U2, setMaster_U2] = useState(false);
	let [Master_U3, setMaster_U3] = useState(false);

	const onMasterChanged1 = (checked) => {
		setMaster_U1(checked);
		setMaster_U2(false);
		setMaster_U3(false);
		console.log("Master1");
	};
	const onMasterChanged2 = (checked) => {
		setMaster_U1(false);
		setMaster_U2(checked);
		setMaster_U3(false);
		console.log("Master2");
	};

	const onMasterChanged3 = (checked) => {
		setMaster_U1(false);
		setMaster_U2(false);
		setMaster_U3(checked);
		console.log("Master3");
	};


	return (
		<>
			<label id="TitleLabel">Unreal Chromakey Control Panel</label>
			<div className="MasterSelect">
				<label className="MasterLabel">Master Unreal:</label>
				<div className="Unreals" id="Master1_box">
					<ToggleSwitch id="Master_U1" checked={Master_U1} onChange={onMasterChanged1} />
				</div>
				<div className="Unreals" id="Master2_box">
					<ToggleSwitch id="Master_U2" checked={Master_U2} onChange={onMasterChanged2} />
				</div>	
				<div className="Unreals" id="Master3_box">
					<ToggleSwitch id="Master_U3" checked={Master_U3} onChange={onMasterChanged3} />
				</div>
				<button id="But0" className="button button1">Copy Master to Others</button>
			</div>
		</>
	);
}


function TopPanel() {
  	return (

		<div className="TopPanel">
			<MasterSelect />
		</div>
  	);
}

export default TopPanel;
