package main

import (
	"bytes"
	"encoding/binary"
	"flag"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var addr = flag.String("addr", ":8080", "http service address")

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

func echo(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()
	for {
		messageType, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		if messageType == websocket.BinaryMessage {
			log.Printf("recv binary: %x", message)
		} else {
			log.Printf("recv text: %s", message)
		}

		/* err = c.WriteMessage(mt, message)
		if err != nil {
			log.Println("write:", err)
			break
		} */
	}
}

func gamepad(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()

	emulator, err := NewEmulator(func(vibration Vibration) {
		// c.WriteMessage(websocket.BinaryMessage, []byte{vibration.LargeMotor, vibration.SmallMotor})
	})
	if err != nil {
		log.Printf("unable to start ViGEm client: %v", err)
		return
	}
	defer emulator.Close()
	x360, err := emulator.CreateXbox360Controller()
	if err != nil {
		log.Printf("unable to create emulated Xbox 360 controller: %v", err)
		return
	}
	defer x360.Close()
	if err = x360.Connect(); err != nil {
		log.Printf("unable to connect to emulated Xbox 360 controller: %v", err)
		return
	}

	report := Xbox360ControllerReport{}
	var intermediateReport struct {
		Buttons      uint16
		LeftTrigger  byte
		RightTrigger byte
		LeftAxisX    int16
		LeftAxisY    int16
		RightAxisX   int16
		RightAxisY   int16
	}

	for {
		messageType, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		if messageType == websocket.BinaryMessage {
			//log.Printf("recv binary: %08b", message)
			reader := bytes.NewReader(message)
			if err := binary.Read(reader, binary.BigEndian, &intermediateReport); err != nil {
				log.Println("binary.Read failed:", err)
				continue
			}
			intermediateReport.LeftAxisY *= -1
			intermediateReport.RightAxisY *= -1
			//log.Printf("report struct: %v", intermediateReport)
			report.SetButtons(intermediateReport.Buttons)
			report.SetLeftTrigger(intermediateReport.LeftTrigger)
			report.SetRightTrigger(intermediateReport.RightTrigger)
			report.SetLeftThumb(intermediateReport.LeftAxisX, intermediateReport.LeftAxisY)
			report.SetRightThumb(intermediateReport.RightAxisX, intermediateReport.RightAxisY)
			err = x360.Send(&report)
			if err != nil {
				log.Println("Sending report to emulated x360 failed: ", err)
			}
		} else {
			log.Printf("recv text: %s", message)
		}

		/* err = c.WriteMessage(mt, message)
		if err != nil {
			log.Println("write:", err)
			break
		} */
	}
}

func main() {
	flag.Parse()
	log.SetFlags(0)
	http.HandleFunc("/echo", echo)
	http.HandleFunc("/gamepad", gamepad)
	log.Fatal(http.ListenAndServe(*addr, nil))
}
