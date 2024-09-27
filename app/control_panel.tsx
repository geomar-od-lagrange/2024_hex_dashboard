import { Padding } from 'maplibre-gl';
import React, {useState} from 'react';

export default function ControlPanel(
  {setControlPanelSlider, setControlPanelRadioButtonDays, setControlPanelRadioButtonDepth, setControlPanelCheckBox}
) {
    const [radiobutton_days, setRadioButtonDays] = useState("00d-07d");
    const [radiobutton_depth, setRadioButtonDepth] = useState("05m");
    const [slider, setSlider] = useState(2020);
    const [checkbox, setCheckBox] = useState(false);
  
    function handleRadioButtonsDays(e) {
      setRadioButtonDays(e.target.value);
    }

    function handleRadioButtonsDepth(e) {
      setRadioButtonDepth(e.target.value);
    }
  
    function handleSlider(e) {
      setSlider(e.target.value);
    };

    function handleCheckBox(e) {
      setCheckBox(e.target.checked);
    };

    setControlPanelRadioButtonDays(radiobutton_days);
    setControlPanelRadioButtonDepth(radiobutton_depth);
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
        <p className="layout">
          <span className="col-left">low</span>
          <span className="col-middle">concentration</span>
          <span className="col-right">high</span>
        </p>

        <fieldset>
          <legend>Days travelled:</legend>

          <div>
            <input type="radio" id="00d-07d" name="radiobutton_days" value="00d-07d" onChange={handleRadioButtonsDays} defaultChecked />
            <label>0-7d -- free Bonamia</label>
          </div>

          <div>
            <input type="radio" id="07d-14d" name="radiobutton_days" value="07d-14d" onChange={handleRadioButtonsDays}/>
            <label>7-14d -- larvae, fast dev</label>
          </div>

          <div>
            <input type="radio" id="14d-28d" name="radiobutton_days" value="14d-28d" onChange={handleRadioButtonsDays}/>
            <label>14-28d -- larvae, slow dev</label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Dispersal depth:</legend>

          <div>
            <input type="radio" id="05m" name="radiobutton_depth" value="05m" onChange={handleRadioButtonsDepth} defaultChecked />
            <label>5 meters</label>
          </div>

          <div>
            <input type="radio" id="10m" name="radiobutton_depth" value="10m" onChange={handleRadioButtonsDepth} />
            <label>10 meters</label>
          </div>

          <div>
            <input type="radio" id="15m" name="radiobutton_depth" value="15m" onChange={handleRadioButtonsDepth} />
            <label>15 meters</label>
          </div>

        </fieldset>

        <fieldset>
          <legend>Settings:</legend>

          <div>
            <input type="checkbox" id="3D" name="3D" onChange={handleCheckBox} />
            <label>render in 3D</label>
          </div>
        </fieldset>

        {/* <div>
          <input type="range" id="volume" name="volume" min="0" max="11" step="1" onChange={handleSlider}/>
          <label>Slider label</label>
        </div> */}
      </div>
    )
  }
