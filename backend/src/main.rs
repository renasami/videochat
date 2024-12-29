mod server;
mod utils;

use utils::get_port;
use server::start_signaling_server;
use env_logger::init;
use std::env;

#[tokio::main]
async fn main() {
    env::set_var("RUST_LOG", "info");
    init();
    let port = get_port();
    let peers = server::peers::PeerMap::default();

    start_signaling_server(port, peers).await;
}
