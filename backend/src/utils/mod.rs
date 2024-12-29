pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn get_port() -> u16 {
    3030
}