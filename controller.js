const MAX_VELNORM_METER_PER_SEC = 4.0;
const VELANGLE_DEG_PER_DIGIT = 2.0;
const MAX_OMEGA_RAD_PER_SEC = 2*Math.PI;
const SEND_CYCLE = 16; //[ms]

var connectionId = -1;

function disableUI() {
  document.getElementById('ui').style.visibility="hidden";
};

function enableUI() {
  document.getElementById('ui').style.visibility="visible";
};


input_id = 0;
input_vel_norm = 0;
input_vel_theta = 0;
input_omega = 0;
input_kick_type = 'STRAIGHT'
input_kick_power = 0;
input_dribble_power = 0;
input_charge_enable = false;
input_hold_kicker   = false;


function sendUIValue()
{
  var robot_command = new Object();

  robot_command.id            = input_id;
  robot_command.vel_norm      = input_vel_norm;
  robot_command.vel_theta     = input_vel_theta;
  robot_command.omega         = input_omega;
  robot_command.kick_type     = input_kick_type;
  robot_command.kick_power    = input_kick_power;
  robot_command.dribble_power = input_dribble_power;
  robot_command.charge_enable = input_charge_enable;

  send(robot_command);

  // Disable kicker
  if (!input_hold_kicker && input_kick_type != 'None') {
    document.getElementById('kick_power').value     = 0;
    input_kick_power = 0;
    input_kick_type = 'None';
  }
};


function halt()
{
  input_vel_norm      = 0.0;
  input_vel_theta     = 0.0;
  input_omega         = 0.0;
  input_kick_power    = 0.0;
  input_dribble_power = 0.0;

  document.getElementById('velocity_x').value     = 0;
  document.getElementById('velocity_y').value     = 0;
  document.getElementById('omega').value          = 0;
  document.getElementById('dribble_power').value  = 0;
  document.getElementById('kick_power').value     = 0;

  sendUIValue();

  print("HALTED!")
};


function send(robot_command) {
  var serialized_data = serialize(robot_command);
  var dataview = new DataView(serialized_data);

  if (document.getElementsByName('show_packet')[0].checked == true) {
    var str_out = new String();
    for (var i=0; i<10; i++) {
      str_out += dataview.getUint8(i).toString(16) + ", "
    }
    print(str_out);
  }

  chrome.serial.send(connectionId, serialized_data, function() {});
};


function serialize(robot_command) {
  var num_packet = 10;
  var buffer = new ArrayBuffer(num_packet);
  var uint8View = new Uint8Array(buffer);

  var binarized_command = new Object();
  binarized_command = scalingToBinary(robot_command);

  uint8View[0] = 0x7F;
  uint8View[1] = 0x80;

  uint8View[2] = binarized_command.id;

  uint8View[3] = binarized_command.vel_norm;
  uint8View[4] = binarized_command.vel_theta;
  uint8View[5] = binarized_command.omega;

  uint8View[6] = 0x00;
  if (binarized_command.dribble_power > 0) {
    uint8View[6] |= 0x80;
  }
  if (binarized_command.kick_power > 0) {
    uint8View[6] |= 0x10;
  }
  if (binarized_command.kick_type == "CHIP") {
    uint8View[6] |= 0x08;
  }

  if (binarized_command.charge_enable == true) {
    uint8View[6] |= 0x02;
  }

  // TODO : ErrFlag


  // TODO : Overflow err expression
  uint8View[7] = 0x00;
  uint8View[7] += binarized_command.dribble_power;
  uint8View[7] <<= 4;
  uint8View[7] += binarized_command.kick_power;

  // Make checksum
  uint8View[8] = 0x00;
  for (var i=2; i<8; i++) {
    uint8View[8] ^= uint8View[i];
  }
  uint8View[9] = uint8View[8] ^ 0xFF;

  return  buffer;
};


// convert MKS unit to binary data in order to send as packet
function scalingToBinary(robot_command) {
  var command_binary = new Object();
  command_binary = robot_command;

  // Velocity Norm
  command_binary.vel_norm = robot_command.vel_norm * 255 / 4;
  if (command_binary.vel_norm > 255) {
    command_binary.vel_norm = 255;
  } else if (command_binary.vel_norm < 0) {
    command_binary.vel_norm = 0;
  }

  // Velcity angle
  command_binary.vel_theta = robot_command.vel_theta / 2;
  if (command_binary.vel_theta > 180) {
    command_binary.vel_theta = 180;
  } else if (command_binary.vel_theta < 0) {
    command_binary.vel_theta = 0;
  }

  // Angular velocity
  command_binary.omega = robot_command.omega / (2*Math.PI) * 127 + 127;
  if (command_binary.omega > 254) {
    command_binary.omega = 254;
  } else if (command_binary.omega < 0) {
    command_binary.omega = 0;
  }

  // Dribble power
  if (command_binary.dribble_power > 15) {
    command_binary.dribble_power = 15;
  } else if (command_binary.dribble_power < 0) {
    command_binary.dribble_power = 0;
  }

  // Kick power
  if (command_binary.kick_power > 15) {
    command_binary.kick_power = 15;
  }else if (command_binary.kick_power < 0) {
    command_binary.kick_power = 0;
  }

  return  command_binary;
};


//////////////
// Log output Methods
/////////////
function print(str) {
  var log = document.getElementById('log');
  var time =  getNowTime();
  var str = time + str + "\n" + log.innerText;

  // check lines of log
  var rows = str.split('\n');
  var lines = rows.length;
  var intxt = String();

  for (var i=0; i<lines; i++) {
    if (i > 30) break;
    intxt += rows[i] + '\n';
  }
  log.innerText = intxt;

};

function getNowTime() {
  var now = new Date();

  var hours = now.getHours();
  var minutes = now.getMinutes();
  var seconds = now.getSeconds();

  var align = function(num) {
    var str = String(num);
    if (num < 10) {
      str = "0" + num;
    }
    return  str;
  };

  return "["+align(hours)+":"+align(minutes)+":"+align(seconds)+"]"
};


//////////
// Serial Methods
/////////
function onOpen(connectionInfo) {
  if (!connectionInfo) {
    print('Could not open');
    return;
  }
  connectionId = connectionInfo.connectionId;
  print('Connected');

  enableUI();
};

function buildPortPicker(ports) {
  var eligiblePorts = ports.filter(function(port) {
    return !port.path.match(/[Bb]luetooth/);
  });

  var portPicker = document.getElementById('port-picker');
  eligiblePorts.forEach(function(port) {
    var portOption = document.createElement('option');
    portOption.value = portOption.innerText = port.path;
    portPicker.appendChild(portOption);
  });

  portPicker.onchange = function() {
    if (connectionId != -1) {
      chrome.serial.disconnect(connectionId, openSelectedPort);
      disableUI();
      return;
    }
  };
}

function openSelectedPort() {
  var portPicker = document.getElementById('port-picker');
  var selectedPort = portPicker.options[portPicker.selectedIndex].value;
  var baudPicker = document.getElementById('baud-picker');
  var selectedBaud = baudPicker.options[baudPicker.selectedIndex].value;

  var options = {"bitrate" : parseInt(selectedBaud, 10)};

  chrome.serial.connect(selectedPort, options, onOpen);
}





onload = function() {
  document.getElementById('connect').onclick = function() {
    openSelectedPort();
  };

  document.getElementById('id-picker').onchange = function() {
    input_id  = this.options[this.selectedIndex].value
  }

  document.getElementsByName('continuous_sending')[0].onchange = function() {
    if(this.checked == true) {
      timer = setInterval(sendUIValue, SEND_CYCLE)
      print("Start sending")
    } else {
      clearInterval(timer)
      print("Stop sending")
    }
  };

  document.getElementsByName('charge_enable')[0].onchange = function() {
    input_charge_enable = this.checked
  }
  document.getElementsByName('hold_kicker')[0].onchange = function() {
    input_hold_kicker = this.checked
  }


  document.getElementById('velocity_x').onchange = function() {
    var vel_x = this.value;
    var vel_y = document.getElementById('velocity_y').value;
    input_vel_norm  = Math.hypot(vel_x, vel_y) / 127 * MAX_VELNORM_METER_PER_SEC;
    input_vel_theta = Math.atan2(vel_y, vel_x) / Math.PI * 180 + 180;
  };
  document.getElementById('velocity_y').onchange = function() {
    var vel_y = this.value;
    var vel_x = document.getElementById('velocity_x').value;
    input_vel_norm  = Math.hypot(vel_x, vel_y) / 127 * MAX_VELNORM_METER_PER_SEC;
    input_vel_theta = Math.atan2(vel_y, vel_x) / Math.PI * 180 + 180;
  };
  document.getElementById('omega').onchange = function() {
    input_omega = this.value /127 * MAX_OMEGA_RAD_PER_SEC;
  };

  document.getElementById('dribble_power').onchange = function() {
    input_dribble_power = this.value;
  };

  document.getElementById('kick_straight').onclick = function() {
    input_kick_power  = document.getElementById('kick_power').value;
    input_kick_type   = 'STRAIGHT';
  };
  document.getElementById('kick_chip').onclick = function() {
    input_kick_power  = document.getElementById('kick_power').value;
    input_kick_type   = 'CHIP';
  };

  document.getElementById('halt').onclick = function() {
    halt();
  }

  chrome.serial.getDevices(function(ports) {
    buildPortPicker(ports)
  });
  //buildBaudPicker();

  disableUI();
};
