import React, { useRef, useState } from "react";

const App = () => {
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [isConnected, setIsConnected] = useState(false);

  const socket = new WebSocket("ws://localhost:3030/ws");

  socket.onopen = () => {
    setIsConnected(true);
    console.log("WebSocket connected");
  };

  socket.onclose = () => {
    setIsConnected(false);
    console.log("WebSocket closed");
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log("Message from server:", data);

    if (!peerConnection) {
      console.error("PeerConnection is not initialized");
      return;
    }

    if (data.type === "offer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.sdp)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.send(JSON.stringify({ type: "answer", sdp: answer }));
    } else if (data.type === "answer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.sdp)
      );
    } else if (data.type === "candidate" && data.candidate) {
      try {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        console.log("ICE candidate added successfully");
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
  };

  const startConnection = async () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    if (peerConnection) {
      console.warn("PeerConnection is already initialized");
      return;
    }

    // ローカルストリームを取得
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    // PeerConnectionの初期化
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    setPeerConnection(pc);

    // トラックを追加
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // オファーを作成して送信
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: "offer", sdp: offer }));

    // ICE候補とリモートストリームの処理
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({ type: "candidate", candidate: event.candidate })
        );
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  };

  return (
    <div>
      <h1>P2P Video Chat</h1>
      <div>
        <h2>Connection Status: {isConnected ? "Connected" : "Disconnected"}</h2>
      </div>
      <div>
        <video ref={localVideoRef} autoPlay playsInline muted />
        <video ref={remoteVideoRef} autoPlay playsInline />
      </div>
      <button onClick={startConnection}>Start Connection</button>
    </div>
  );
};

export default App;
