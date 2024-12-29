import React, { useEffect, useRef, useState } from "react";

const App = () => {
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);

  const socket = useRef<WebSocket | null>(null); // WebSocketをuseRefで管理

  // WebSocketの初期化とクリーンアップ
  useEffect(() => {
    socket.current = new WebSocket("ws://localhost:3030/ws");

    socket.current.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    socket.current.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket closed");
    };

    socket.current.onmessage = async (event) => {
      try {
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
          socket.current.send(JSON.stringify({ type: "answer", sdp: answer }));
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
      } catch (error) {
        console.error("Error handling message from server:", error);
      }
    };

    return () => {
      socket.current?.close();
    };
  }, [peerConnection]); // peerConnectionが変更された場合も監視

  const startConnection = async () => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    if (peerConnection) {
      console.warn("PeerConnection is already initialized");
      return;
    }

    try {
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
      socket.current.send(JSON.stringify({ type: "offer", sdp: offer }));

      // ICE候補とリモートストリームの処理
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.current.send(
            JSON.stringify({ type: "candidate", candidate: event.candidate })
          );
        }
      };

      pc.ontrack = (event) => {
        console.log("Received remote track");
        if (remoteVideoRef.current) {
          let remoteStream = remoteVideoRef.current.srcObject as MediaStream;
          if (!remoteStream) {
            remoteStream = new MediaStream();
            remoteVideoRef.current.srcObject = remoteStream;
          }
          remoteStream.addTrack(event.track);
        }
      };
    } catch (error) {
      console.error("Error in startConnection:", error);
    }
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
