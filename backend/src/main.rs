mod server;
mod config;

#[tokio::main]
async fn main() {
    let port = config::get_port();
    server::start(port).await;
}