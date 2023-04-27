use derive_builder::Builder;
use serde::{Deserialize, Serialize};

#[derive(Default, Builder, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebAuthConfig {
    pub domain: String,
    #[serde(rename = "clientID")]
    pub client_id: String,
    pub address: Option<String>,
    pub scope: Option<String>,
    pub audience: Option<String>,
    pub response_type: Option<String>,
    pub response_mode: Option<String>,
    pub leeway: Option<usize>,
    pub _disable_deprecation_warnings: Option<bool>,
}

fn main() {
    let builder = WebAuthConfigBuilder::default();
    let config = builder.build().unwrap();
    println!("{:?}", config);
}
