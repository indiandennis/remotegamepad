const BUTTON_MAPPING = [
    12, 13, 14, 15,     // DPAD up down left right
    9, 8,               // start back
    10, 11,             // left right stick
    4, 5,               // left right shoulder
    16,                 // guide
    -1,                 // empty bit, do not use (-1 so that it will fail noisily if used)
    0, 1, 2, 3,         // A B X Y
]
const TRIGGER_MAPPING = [6, 7,]       //left right trigger in buttons array
const AXIS_MAPPING = [0, 1, 2, 3,]    // left right x y in axes array

let ws;
let POLLING = false
let POLL_WAIT = 4

window.addEventListener("load", function (evt) {
    let output = document.getElementById("output");
    let input = document.getElementById("input");
    let print = function (message) {
      var d = document.createElement("div");
      d.textContent = message;
      output.appendChild(d);
      output.scroll(0, output.scrollHeight);
    };
    document.getElementById("pollrate").value = 250
    document.getElementById("pollrate").onchange = (evt) => {
      POLL_WAIT = 1000 / Number(evt.target.value)
      console.log(`Now polling every ${POLL_WAIT} ms`)
    }
    document.getElementById("open").onclick = function (evt) {
      if (ws) {
        return false;
      }
      ws = new WebSocket(document.getElementById('wsserver').value);
      ws.onopen = function (evt) {
        /* ws.onmessage = (evt) => {
          const dataview = new DataView(evt.data)
          const large = dataview.getUint8(1)
          const small = dataview.getUint8(0)
          console.log(`received vibration: large:${large}, small: ${small}`)

          let gp = navigator.getGamepads()[0]
        } */
        print("OPEN");
      }
      ws.onclose = function (evt) {
        print("CLOSE");
        ws = null;
      }
      ws.onmessage = function (evt) {
        print("RESPONSE: " + evt.data);
      }
      ws.onerror = function (evt) {
        print("ERROR: " + evt.data);
      }
      return false;
    };
    document.getElementById("close").onclick = function (evt) {
      if (!ws) {
        return false;
      }
      ws.close();
      return false;
    };
  });


const pollGamepad = async () => {
    console.log(`Starting polling every ${POLL_WAIT} ms`)
    const buffer = new ArrayBuffer(12)
    const dataview = new DataView(buffer)
    while(POLLING) {
        const gamepads= navigator.getGamepads()
        gamepadToBuffer(gamepads[0], dataview)
        if (ws) { ws.send(buffer)}
        await sleep(POLL_WAIT);
    }
}

function gamepadToBuffer(gamepad, dataview) {
    let buttonShort = 0
    for (let i = 0; i < 16; i++) {
        if (i == 11) continue;
        buttonShort |= (gamepad.buttons[BUTTON_MAPPING[i]]?.pressed << i)
    }
    dataview.setUint16(0, buttonShort)
    dataview.setUint8(2, Math.trunc(gamepad.buttons[TRIGGER_MAPPING[0]].value * 255))
    dataview.setUint8(3, Math.trunc(gamepad.buttons[TRIGGER_MAPPING[1]].value * 255))
    for (let i = 0; i < 4; i++) {
        dataview.setInt16(4 + i*2, Math.trunc(gamepad.axes[AXIS_MAPPING[i]] * 32767))
    }
}



window.addEventListener('gamepadconnected', (event) => {
    const gp = event.gamepad;
    console.log(`Gamepad connected at index ${gp?.index}: ${gp?.id} with ${gp?.buttons.length} buttons, ${gp?.axes.length} axes.`);
    POLLING = true
    pollGamepad()
});

window.addEventListener('gamepaddisconnected', (event) => {
    console.log(`Gamepad disconnected`);
    POLLING = false
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}