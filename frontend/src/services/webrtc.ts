import Peer from "simple-peer";

export function createPeer(
  initiator: boolean,
  stream: MediaStream,
  onSignal: (signal: any) => void,
  onStream: (stream: MediaStream) => void
) {
  const peer = new Peer({ initiator, stream });

  peer.on("signal", (signal) => {
    onSignal(signal);
  });

  peer.on("stream", (remoteStream) => {
    onStream(remoteStream);
  });

  return peer;
}

export function connectPeers(peer: Peer.Instance, signal: any) {
  peer.signal(signal);
}
