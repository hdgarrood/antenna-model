// lengths are in mm unless otherwise stated
let defaults = {
  // wavelength
  wavelength: 20,
  // transmitter separation (as a proportion of wavelength)
  separation: 0.5,
  // number of transmitter groups
  transmitterGroups: 6,
  // number of transmitters per group
  transmittersPerGroup: 10,
  // angle to aim transmitters (using phase differences)
  transmitAngle: 0,
  // receiver distance
  distance: 100000,
  // receiver angle
  receiverAngle: 0
};

function deg2rad(deg) {
  return deg / 180 * Math.PI;
}

function rad2deg(rad) {
  return rad * 180 / Math.PI;
}

function distance(a, b) {
  let xdiff = a.x - b.x;
  let ydiff = a.y - b.y;
  return Math.sqrt((xdiff * xdiff) + (ydiff * ydiff));
}

function count_wavelengths(params, a, b) {
  return distance(a, b) / params.wavelength;
}

function get_wave_from_transmitter(params, t, r) {
  return {
    scale: 1,
    phaseShift: 2 * Math.PI *
      ( count_wavelengths(params, t, r) + // phase shift from distance
        params.groupPhaseShiftFunc(params, t.group) // phase shift from transmitter group
      )
  };
}

// when adding waves we need to keep track of both the scale and the phase
// shift
function add_waves(x, y) {
  return {
    scale: Math.sqrt(
      (x.scale * x.scale) +
      (y.scale * y.scale) +
      (2 * x.scale * y.scale * Math.cos(x.phaseShift - y.phaseShift))),
    phaseShift: Math.atan2(
      x.scale * Math.sin(x.phaseShift) + y.scale * Math.sin(y.phaseShift),
      x.scale * Math.cos(x.phaseShift) + y.scale * Math.cos(y.phaseShift))
  };
}

function get_model_from_params(params) {
  let separationMM = params.wavelength * params.separation;
  let numTransmitters = params.transmittersPerGroup * params.transmitterGroups;
  let arrayWidth = (numTransmitters - 1) * separationMM;
  let transmitters = Array(numTransmitters).fill(null).map((_, i) => {
    let group = Math.floor(i / params.transmittersPerGroup);
    return {
      group,
      index: i % params.transmittersPerGroup,
      x: i * separationMM,
      y: 0
    };
  });
  let receiverAngle = -params.receiverAngle + (Math.PI / 2);
  let receiver = {
    x: params.distance * Math.cos(receiverAngle),
    y: params.distance * Math.sin(receiverAngle)
  };

  return { transmitters, receiver };
}

function params_from_dom() {
  return {
    wavelength: Number(document.getElementById('wavelength').value),
    distance: Number(document.getElementById('distance').value) * 1000,
    separation: Number(document.getElementById('separation').value),
    transmittersPerGroup: Number(document.getElementById('transmittersPerGroup').value),
    transmitterGroups: Number(document.getElementById('transmitterGroups').value),
    transmitAngle: Number(document.getElementById('transmitAngle').value),
    groupPhaseShiftFunc: new Function('params', 'group', document.getElementById('groupPhaseShiftFunc').value)
  };
}

function draw() {
  drawChart();
  drawCanvas();
  updateDisplayTexts();
}

function drawChart() {
  let init_params = params_from_dom();
  let interp = x => (x * 180) - 90;
  let chartData = new Array(1000).fill(null).map((_, i) => {
    let deg = interp(i/1000);
    let params = { ...init_params, receiverAngle: deg2rad(deg) };
    let { transmitters, receiver } = get_model_from_params(params);
    return {
      x: deg,
      y: transmitters.map(t => get_wave_from_transmitter(params, t, receiver)).reduce(add_waves).scale
    };
  });
  window.chartData = chartData;
  let maxY = chartData.map(p => p.y).reduce((a,b) => Math.max(a,b));
  new Chartist.Line('.ct-chart', {
    series: [
      {
        name: 'data',
        data: chartData,
      }, {
        name: 'angle',
        data: [
          { x: init_params.transmitAngle - 2, y: 2 * maxY },
          { x: init_params.transmitAngle + 2, y: 2 * maxY }
        ]
      }
    ]
  }, {
    axisX: {
      type: Chartist.FixedScaleAxis,
      high: 90,
      low: -90,
      divisor: 18
    },
    axisY: {
      type: Chartist.AutoScaleAxis,
      high: Math.ceil(maxY),
      integerOnly: true
    },
    series: {
      'angle': {
        showArea: true,
        showPoint: false
      }
    }
  });
}

function drawCanvas() {
  // Draw one group on the canvas
  let canvas = document.getElementById('transmitter-group-canvas');
  let ctx = canvas.getContext('2d');
  let canvas_width = 400;
  let canvas_height = 200;
  ctx.clearRect(0, 0, canvas_width, canvas_height);

  let params = params_from_dom();
  // width of a group in wavelengths
  let groupWidth = (params.transmittersPerGroup - 1) * params.separation;
  // want the whole canvas to be a bit bigger than the width of the group
  let pixels_per_wavelength = canvas_width / (groupWidth * 1.2);
  let pixels_per_mm = pixels_per_wavelength / params.wavelength;

  let model_to_canvas = (({ x, y }) => {
    return {
      x: (canvas_width / 10) + (x * pixels_per_mm),
      y: (canvas_height * 0.8) - (y * pixels_per_mm)
    };
  });

  let model = get_model_from_params(params);
  model.transmitters.filter(t => t.group == 0).forEach((t, i) => {
    let transmitter = model_to_canvas(t);

    let line_length = canvas_width;
    let line_angle = params.transmitAngle - 90;
    let line_end_x = transmitter.x + (line_length * Math.cos(deg2rad(line_angle)));
    let line_end_y = transmitter.y + (line_length * Math.sin(deg2rad(line_angle)));
    ctx.strokeStyle = 'rgb(0,0,200)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(transmitter.x, transmitter.y);
    ctx.lineTo(line_end_x, line_end_y);
    ctx.stroke();

    ctx.fillStyle = 'rgb(200, 0, 0)';

    ctx.beginPath();
    ctx.arc(transmitter.x, transmitter.y, 5, 0, 2 * Math.PI);
    ctx.fill();
  });
}

function updateDisplayTexts() {
  let params = params_from_dom();
  Array.from(document.querySelectorAll('span.display')).forEach(el => {
    let k = el.getAttribute('data-value');
    if (k == 'distance') {
      el.innerText = String(params[k] / 1000);
    } else {
      el.innerText = String(params[k]);
    }
  });
}

draw();

['input', 'textarea'].forEach(tagName => {
  Array.from(document.getElementsByTagName(tagName)).forEach(i => {
    i.addEventListener('change', draw);
    i.addEventListener('input', draw);
  });
});
