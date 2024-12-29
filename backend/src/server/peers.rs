use std::sync::{Arc, Mutex};
use warp::ws::Message;
use tokio::sync::mpsc::UnboundedSender;

pub type PeerMap = Arc<Mutex<std::collections::HashMap<String, UnboundedSender<Message>>>>;
