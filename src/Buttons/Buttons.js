import React from "react";
import './Buttons.css';

export default function Button1(props) {
	const id = props.id;
	const value = props.value;
	const onClick = props.onClick;
	const styl = props.styl;

	return (
		<button id={id} className={"button "+styl} onClick={onClick}>{value}</button>
	);
}