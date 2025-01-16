import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./App.css"; // External CSS file for styles

const socket = io("http://localhost:5000");

const App = () => {
  const [name, setName] = useState(localStorage.getItem("name") || "");
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [sessionDuration, setSessionDuration] = useState(0);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (name) {
      localStorage.setItem("name", name);
      socket.emit("set-name", name);
    }
  }, [name]);

  const handleNameSubmit = () => {
    if (name.trim()) {
      setNameSubmitted(true);
    } else {
      alert("Please enter a valid name.");
    }
  };

  const generateRoomCode = () => {
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    setRoomCode(newCode);
    socket.emit("create-room", newCode);
  };

  const joinRoom = () => {
    if (roomCode.trim()) {
      socket.emit("join-room", roomCode);
    } else {
      alert("Please enter a valid room code.");
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      localVideoRef.current.srcObject = stream;
      setIsSharing(true);

      peerConnection.current = createPeerConnection();
      stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.emit("signal", { target: roomCode, offer });
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  const stopScreenShare = () => {
    const stream = localVideoRef.current.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      localVideoRef.current.srcObject = null;
    }
    setIsSharing(false);
  };

  useEffect(() => {
    socket.on("signal", async (data) => {
      if (!peerConnection.current) {
        peerConnection.current = createPeerConnection();
      }

      if (data.offer) {
        await peerConnection.current.setRemoteDescription(data.offer);
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("signal", { target: data.target, answer });
      } else if (data.answer) {
        await peerConnection.current.setRemoteDescription(data.answer);
      } else if (data.candidate) {
        await peerConnection.current.addIceCandidate(data.candidate);
      }
    });

    return () => socket.off("signal");
  }, [roomCode]);

  useEffect(() => {
    socket.on("participants-updated", (updatedParticipants) => {
      setParticipants(updatedParticipants);
    });

    return () => socket.off("participants-updated");
  }, []);

  useEffect(() => {
    if (isSharing) {
      timerRef.current = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setSessionDuration(0);
    }

    return () => clearInterval(timerRef.current);
  }, [isSharing]);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection();
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { target: roomCode, candidate: event.candidate });
      }
    };
    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };
    return pc;
  };

  const leaveRoom = () => {
    socket.emit("leave-room", roomCode);
    setRoomCode("");
    setParticipants([]);
    stopScreenShare();
  };

  return (
    <div className="container">
      {!nameSubmitted ? (
        <div className="name-prompt">
          <h2>Enter Your Name</h2>
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="name-input"
          />
          <button onClick={handleNameSubmit} className="submit-button">
            Submit
          </button>
        </div>
      ) : (
        <>
          <h1 className="heading">Screen Sharing App</h1>
          <div className="main-content">
            <div className="screen-share-container">
              <div className="video-container">
                <video ref={localVideoRef} autoPlay muted className="video" />
                <video ref={remoteVideoRef} autoPlay className="video" />
              </div>
              <div className="controls">
                <button onClick={generateRoomCode} className="button">
                  Generate Room Code
                </button>
                <input
                  type="text"
                  placeholder="Enter Room Code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="input"
                />
                <button onClick={joinRoom} className="button">
                  Join Room
                </button>
                <button onClick={leaveRoom} className="button-danger">
                  Leave Room
                </button>
              </div>
              <div className="sharing-controls">
                {isSharing ? (
                  <button onClick={stopScreenShare} className="button-danger">
                    Stop Sharing
                  </button>
                ) : (
                  <button onClick={startScreenShare} className="button">
                    Start Screen Share
                  </button>
                )}
              </div>
            </div>
            <div className="participants">
              <h3>Participants:</h3>
              <ul>
                {participants.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="timer">Session Duration: {sessionDuration} seconds</div>
        </>
      )}
    </div>
  );
};

export default App;
