use warp::Filter;
use super::peers::PeerMap;


pub async fn start_signaling_server(port: u16, peers: PeerMap) {
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(warp::any().map(mode || peers.clone()))
        .map(|ws: warp::ws:Ws, peers| {
            ws.on_upgrade(mode |socket| handle_connection(socket, peers))
        })

    println!("Server running on ws://localhost:{}",port)
    warp::server(ws_route).run(([127,0,0,1],port)).await
}

async fn handle_connection(socket::ws::Websocket, peers:PeerMap) {
    
}