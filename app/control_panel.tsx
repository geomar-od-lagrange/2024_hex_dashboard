import { Padding } from 'maplibre-gl';
import React, {useState} from 'react';

export default function ControlPanel(
  {setControlPanelSlider, setControlPanelRadioButton, setControlPanelCheckBox}
) {
    const [radiobutton, setRadioButton] = useState("00d-07d");
    const [slider, setSlider] = useState(2020);
    const [checkbox, setCheckBox] = useState(true);
  
    function handleRadioButtons(e) {
      setRadioButton(e.target.value);
    }
  
    function handleSlider(e) {
      setSlider(e.target.value);
    };

    function handleCheckBox(e) {
      setCheckBox(e.target.checked);
    };

    setControlPanelRadioButton(radiobutton);
    setControlPanelSlider(slider);
    setControlPanelCheckBox(checkbox);
  
    return (
      <div>
        <div className='container'>
          <div className="colorbar c1"></div>
          <div className="colorbar c2"></div>
          <div className="colorbar c3"></div>
          <div className="colorbar c4"></div>
          <div className="colorbar c5"></div>
          <div className="colorbar c6"></div>
          <div className="colorbar c7"></div>
          <div className="colorbar c8"></div>
          <div className="colorbar c9"></div>
        </div>
        <p className="layout"><span className="col-left">low</span><span className="col-right">high</span></p>

        <fieldset>
          <legend>Dataset:</legend>

          <div>
            <input type="radio" id="00d-07d" name="radiobutton" value="00d-07d" onChange={handleRadioButtons} defaultChecked />
            <label>00d-07d</label>
          </div>

          <div>
            <input type="radio" id="07d-14d" name="radiobutton" value="07d-14d" onChange={handleRadioButtons}/>
            <label>07d-14d</label>
          </div>

          <div>
            <input type="radio" id="14d-28d" name="radiobutton" value="14d-28d" onChange={handleRadioButtons}/>
            <label>14d-28d</label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Settings:</legend>

          <div>
            <input type="checkbox" id="3D" name="3D" onChange={handleCheckBox} defaultChecked />
            <label>3D</label>
          </div>
        </fieldset>

        {/* <div>
          <input type="range" id="volume" name="volume" min="0" max="11" step="1" onChange={handleSlider}/>
          <label>Slider label</label>
        </div> */}
      </div>
    )
  }
