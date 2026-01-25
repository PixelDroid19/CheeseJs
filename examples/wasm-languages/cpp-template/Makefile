# Makefile for C++ WASM compilation with Emscripten

# Compiler settings
EMCC = emcc
CXXFLAGS = -std=c++17 -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='["_create_runtime", "_destroy_runtime", "_run_code", "_get_stdout", "_get_stderr"]' -s EXPORTED_RUNTIME_METHODS='["cwrap", "getValue", "setValue", "UTF8ToString", "stringToUTF8"]' -s MODULARIZE=1 -s EXPORT_NAME="CppRuntime"

# Directories
SRC_DIR = src
BUILD_DIR = runtime
OUT_FILE = $(BUILD_DIR)/runtime.wasm

# Source files
SOURCES = $(SRC_DIR)/runtime.cpp

.PHONY: all clean directories

all: directories $(OUT_FILE)

directories:
	@mkdir -p $(BUILD_DIR)

$(OUT_FILE): $(SOURCES)
	$(EMCC) $(CXXFLAGS) $(SOURCES) -o $(OUT_FILE)

clean:
	rm -rf $(BUILD_DIR)
