mod server;
mod utils;

use utils::get_port;
use server::start_signaling_server;

#[tokio::main]
async fn main() {
    let port = get_port();
    let peers = server::peers::PeerMap::default();

    start_signaling_server(port, peers).await;
}
