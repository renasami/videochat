use warp::Filter;
use warp::ws::{Message, WebSocket};
use futures_util::{StreamExt, SinkExt};
use super::peers::PeerMap;
use log::{info, warn, error}; // ログクレートを使用

// シグナリングサーバーを開始する関数
pub async fn start_signaling_server(port: u16, peers: PeerMap) {
    // WebSocketのエンドポイントを作成
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(warp::any().map(move || peers.clone())) // クローンしたPeerMapを渡す
        .map(|ws: warp::ws::Ws, peers| {
            ws.on_upgrade(move |socket| handle_connection(socket, peers)) // 接続時の処理を指定
        });

    info!("Server running on ws://localhost:{}/ws", port); // サーバー起動ログ
    warp::serve(ws_route).run(([127, 0, 0, 1], port)).await;
}

// WebSocket接続を処理する関数
async fn handle_connection(socket: WebSocket, peers: PeerMap) {
    // WebSocketを送信と受信に分割
    let (mut sender, mut receiver) = socket.split();

    // 非同期チャンネルを作成
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let id = uuid::Uuid::new_v4().to_string(); // 一意の接続IDを生成

    info!("New connection: {}", id); // 新規接続ログ

    {
        let mut lock = peers.lock().unwrap();
        // 最大接続数を確認
        if lock.len() >= 100 {
            warn!("Connection limit reached. Rejecting {}", id);
            return;
        }
        // PeerMapに接続を登録
        lock.insert(id.clone(), tx);
    }

    // メッセージ送信タスクを生成
    tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if sender.send(message).await.is_err() {
                break; // エラーが発生した場合は終了
            }
        }
    });

    // メッセージ受信ループ
    while let Some(result) = receiver.next().await {
        match result {
            Ok(msg) => {
                info!("[{}] Received message: {:?}", id, msg); // 受信ログ
                if let Ok(text) = msg.to_str() {
                    info!("[{}] Text message: {}", id, text); // テキストメッセージログ
                    broadcast_message(&id, text, &peers).await;
                }
            }
            Err(e) => {
                error!("[{}] WebSocket error: {}", id, e); // エラーログ
                break;
            }
        }
    }

    // 接続終了時の処理
    peers.lock().unwrap().remove(&id); // PeerMapから削除
    info!("Connection closed: {}", id); // 接続終了ログ
    broadcast_message(&id, &format!("{{\"type\": \"disconnect\", \"id\": \"{}\"}}", id), &peers).await;
}

// メッセージを全クライアントにブロードキャストする関数
async fn broadcast_message(sender_id: &str, message: &str, peers: &PeerMap) {
    let peers = peers.lock().unwrap();

    for (peer_id, tx) in peers.iter() {
        if peer_id != sender_id { // 自分以外のクライアントに送信
            if let Err(e) = tx.send(Message::text(message)) {
                error!("Error sending message to {}: {}", peer_id, e); // エラーログ
            }
        }
    }
}
