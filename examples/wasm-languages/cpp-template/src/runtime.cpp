#include <emscripten.h>
#include <string>
#include <vector>
#include <sstream>
#include <cstring>

extern "C" {
    
    struct WasmRuntime {
        std::vector<char> stdout_buffer;
        std::vector<char> stderr_buffer;
    };
    
    EMSCRIPTEN_KEEPALIVE
    WasmRuntime* create_runtime() {
        return new WasmRuntime();
    }
    
    EMSCRIPTEN_KEEPALIVE
    void destroy_runtime(WasmRuntime* runtime) {
        delete runtime;
    }
    
    EMSCRIPTEN_KEEPALIVE
    int run_code(WasmRuntime* runtime, const char* code) {
        if (!runtime || !code) {
            return -1;
        }
        
        runtime->stdout_buffer.clear();
        runtime->stderr_buffer.clear();
        
        std::string code_str(code);
        
        if (code_str.empty()) {
            return 0;
        }
        
        if (code_str.find("std::cout") != std::string::npos) {
            std::string output = code_str + "\n";
            runtime->stdout_buffer.insert(
                runtime->stdout_buffer.end(),
                output.begin(),
                output.end()
            );
            return 0;
        }
        
        if (code_str.find("std::cout <<") != std::string::npos) {
            size_t pos = code_str.find("std::cout <<");
            std::string expr = code_str.substr(pos + 11);
            std::string output = "// Output: " + expr + "\n";
            runtime->stdout_buffer.insert(
                runtime->stdout_buffer.end(),
                output.begin(),
                output.end()
            );
            return 0;
        }
        
        std::string output = code_str + "\n";
        runtime->stdout_buffer.insert(
            runtime->stdout_buffer.end(),
            output.begin(),
            output.end()
        );
        
        return 0;
    }
    
    EMSCRIPTEN_KEEPALIVE
    const char* get_stdout(WasmRuntime* runtime, int* size) {
        if (!runtime) {
            *size = 0;
            return nullptr;
        }
        
        runtime->stdout_buffer.push_back('\0');
        *size = static_cast<int>(runtime->stdout_buffer.size());
        return runtime->stdout_buffer.data();
    }
    
    EMSCRIPTEN_KEEPALIVE
    const char* get_stderr(WasmRuntime* runtime, int* size) {
        if (!runtime) {
            *size = 0;
            return nullptr;
        }
        
        runtime->stderr_buffer.push_back('\0');
        *size = static_cast<int>(runtime->stderr_buffer.size());
        return runtime->stderr_buffer.data();
    }
}
