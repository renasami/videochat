use warp::Filter;
use warp::ws::{Message, WebSocket};
use futures_util::{StreamExt, SinkExt};
use super::peers::PeerMap;

pub async fn start_signaling_server(port: u16, peers: PeerMap) {
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(warp::any().map(move || peers.clone()))
        .map(|ws: warp::ws::Ws, peers| {
            ws.on_upgrade(move |socket| handle_connection(socket, peers))
        });

    println!("Server running on ws://localhost:{}/ws", port);
    warp::serve(ws_route).run(([127, 0, 0, 1], port)).await;
}

async fn handle_connection(socket: WebSocket, peers: PeerMap) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let id = uuid::Uuid::new_v4().to_string();

    println!("New connection: {}", id);

    {
        let mut lock = peers.lock().unwrap();
        if lock.len() >= 100 {
            eprintln!("Connection limit reached. Rejecting {}", id);
            return;
        }
        lock.insert(id.clone(), tx);
    }

    tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if sender.send(message).await.is_err() {
                break;
            }
        }
    });

    while let Some(result) = receiver.next().await {
        match result {
            Ok(msg) => {
                println!("[{}] Received message: {:?}", id, msg);
                if let Ok(text) = msg.to_str() {
                    println!("[{}] Text message: {}", id, text);
                    broadcast_message(&id, text, &peers).await;
                }
            }
            Err(e) => {
                eprintln!("[{}] WebSocket error: {}", id, e);
                break;
            }
        }
    }

    peers.lock().unwrap().remove(&id);
    println!("Connection closed: {}", id);
    broadcast_message(&id, &format!("{{\"type\": \"disconnect\", \"id\": \"{}\"}}", id), &peers).await;
}

async fn broadcast_message(sender_id: &str, message: &str, peers: &PeerMap) {
    let peers = peers.lock().unwrap();

    for (peer_id, tx) in peers.iter() {
        if peer_id != sender_id {
            if let Err(e) = tx.send(Message::text(message)) {
                eprintln!("Error sending message to {}: {}", peer_id, e);
            }
        }
    }
}
