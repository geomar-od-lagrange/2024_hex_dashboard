import React, {useState} from 'react';

export default function Counter() {
    const [checked, setChecked] = useState(false);
    const [range, setRange] = useState(50);
  
    function handleCheckboxChange(e) {
      setChecked(e.target.checked);
      console.log(checked)
    }
  
    function handleRangeChange(e) {
      setRange(e.target.value);
      console.log(range)
    }
  
    return (
    <div>
      <div>
        <label>Checkbox label</label>
        <input
            type="checkbox"
            checked={checked}
            onChange={handleCheckboxChange}
        />
      </div>
      <div>
        <label>Slider label</label>
        <input
            type="range"
            min="0"
            max="100"
            onChange={handleRangeChange}
        />
      </div>
    </div>
    )
  }
