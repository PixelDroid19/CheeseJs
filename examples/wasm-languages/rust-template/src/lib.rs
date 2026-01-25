use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmRuntime {
    stdout_buffer: Vec<u8>,
    stderr_buffer: Vec<u8>,
}

#[wasm_bindgen]
impl WasmRuntime {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        WasmRuntime {
            stdout_buffer: Vec::new(),
            stderr_buffer: Vec::new(),
        }
    }

    pub fn run(&mut self, code: &str) -> i32 {
        self.stdout_buffer.clear();
        self.stderr_buffer.clear();

        match self.eval(code) {
            Ok(result) => {
                result
            }
            Err(e) => {
                let error_msg = format!("Error: {}\n", e);
                self.stderr_buffer.extend_from_slice(error_msg.as_bytes());
                1
            }
        }
    }

    pub fn get_stdout(&self) -> String {
        String::from_utf8_lossy(&self.stdout_buffer).to_string()
    }

    pub fn get_stderr(&self) -> String {
        String::from_utf8_lossy(&self.stderr_buffer).to_string()
    }

    fn eval(&mut self, code: &str) -> Result<i32, String> {
        let code = code.trim();
        
        if code.is_empty() {
            return Ok(0);
        }

        if let Some(expr) = code.strip_prefix("print!") {
            let content = expr.trim_start_matches('(').trim_end_matches(')');
            self.stdout_buffer.extend_from_slice(content.as_bytes());
            self.stdout_buffer.extend_from_slice(b"\n");
            return Ok(0);
        }

        if let Some(expr) = code.strip_prefix("println!") {
            let content = expr.trim_start_matches('(').trim_end_matches(')');
            self.stdout_buffer.extend_from_slice(content.as_bytes());
            self.stdout_buffer.extend_from_slice(b"\n");
            return Ok(0);
        }

        let output = format!("{}\n", code);
        self.stdout_buffer.extend_from_slice(output.as_bytes());

        Ok(0)
    }
}

#[wasm_bindgen]
pub fn create_runtime() -> WasmRuntime {
    WasmRuntime::new()
}

#[wasm_bindgen]
pub fn run_code(runtime: &mut WasmRuntime, code: &str) -> i32 {
    runtime.run(code)
}
