use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use warp::ws::Sender;

pub type PeerMap = Arc<Mutex<HashMap<String, Sender>>>;
