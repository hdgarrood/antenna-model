// lengths are in mm unless otherwise stated
let defaults = {
  // wavelength
  lambda: 20,
  // transmitter separation (as a proportion of wavelength)
  separation: 0.5,
  // number of transmitters
  transmitters: 5,
  // receiver distance
  distance: 100000,
  // receiver angle
  theta: 0
};

function deg2rad(deg) {
  return deg / 180 * Math.PI;
}

function distance(a, b) {
  let xdiff = a.x - b.x;
  let ydiff = a.y - b.y;
  return Math.sqrt((xdiff * xdiff) + (ydiff * ydiff));
}

function count_wavelengths(params, a, b) {
  return distance(a, b) / params.lambda;
}

function get_wave_from_transmitter(params, t, r) {
  return {
    scale: 1,
    phaseShift: count_wavelengths(params, t, r) * 2 * Math.PI
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
  let separationMM = params.lambda * params.separation;
  let arrayWidth = (params.transmitters - 1) * separationMM;
  let transmitters = Array(params.transmitters).fill(null).map((_, i) => {
    return {
      y: 0,
      x: -arrayWidth/2 + (i * separationMM)
    };
  });
  let receiverAngle = -params.theta + (Math.PI / 2);
  let receiver = {
    x: params.distance * Math.cos(receiverAngle),
    y: params.distance * Math.sin(receiverAngle)
  };

  return { transmitters, receiver };
}

function params_from_dom() {
  return {
    lambda: Number(document.getElementById('lambda').value),
    separation: Number(document.getElementById('separation').value),
    transmitters: Number(document.getElementById('transmitters').value),
    distance: Number(document.getElementById('distance').value) * 1000,
  };
}

function drawChart() {
  let init_params = params_from_dom();
  let interp = x => (x * 180) - 90;
  let chartData = new Array(1000).fill(null).map((_, i) => {
    let deg = interp(i/1000);
    let params = { ...init_params, theta: deg2rad(deg) };
    let { transmitters, receiver } = get_model_from_params(params);
    return {
      x: deg,
      y: transmitters.map(t => get_wave_from_transmitter(params, t, receiver)).reduce(add_waves).scale
    };
  });
  window.chartData = chartData;
  new Chartist.Line('.ct-chart', {
    series: [chartData]
  }, {
    axisX: {
      type: Chartist.FixedScaleAxis,
      high: 90,
      low: -90,
      divisor: 18
    },
    axisY: {
      type: Chartist.AutoScaleAxis,
      integerOnly: true
    }
  });
}

drawChart();

Array.from(document.getElementsByTagName('input')).forEach(i => {
  i.addEventListener('change', drawChart);
});
