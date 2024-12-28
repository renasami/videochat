const WS_URL = "ws://localhost:3030/ws";

export function createWebSocket(onMessage: (data: any) => void) {
  const socket = new WebSocket(WS_URL);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  return socket;
}

export function sendMessage(socket: WebSocket, message: any) {
  socket.send(JSON.stringify(message));
}
