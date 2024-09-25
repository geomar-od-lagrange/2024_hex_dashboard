import React, {useState} from 'react';

export default function ControlPanel(
  {setControlPanelSlider, setControlPanelRadioButton}
) {
    const [radiobutton, setRadioButton] = useState("00d-07d");
    const [slider, setSlider] = useState(100);
  
    function handleRadioButtons(e) {
      setRadioButton(e.target.value);
    }
  
    function handleSlider(e) {
      setSlider(e.target.value);
    };

    setControlPanelRadioButton(radiobutton);
    setControlPanelSlider(slider);
  
    return (
    <div>
      <div id="radiobutton" onChange={handleRadioButtons}>
        <input type="radio" name="radiobutton" value="00d-07d" defaultChecked={true}/>00d-07d<br></br>
        <input type="radio" name="radiobutton" value="14d-28d"/>14d-28d<br></br>
      </div>
      <div>
        <label>Slider label</label>
        <input
            type="range"
            multiple={true}
            min="0"
            max="1000000"
            onChange={handleSlider}
        />
      </div>
    </div>
    )
  }
