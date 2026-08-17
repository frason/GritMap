#include <jni.h>
#include <dlfcn.h>
#include <sys/stat.h>
#include <unistd.h>
#include <fstream>
#include <cstring>
#include <mutex>
#include <string>

namespace {
using InitFn = void* (*)(const char*, const char*, bool);
using CompleteFn = int (*)(void*, const char*, char*, size_t, const char*, const char*,
                           void*, void*, const void*, size_t);
using ShutdownFn = void (*)(void*);

std::mutex mutex;
void* library = nullptr;
void* runtime = nullptr;
InitFn init_fn = nullptr;
CompleteFn complete_fn = nullptr;
ShutdownFn shutdown_fn = nullptr;

template <typename T> T symbol(const char* name) { return reinterpret_cast<T>(dlsym(library, name)); }

bool load_runtime() {
  if (library) return true;
  library = dlopen("libcactus_engine.so", RTLD_NOW | RTLD_LOCAL);
  if (!library) return false;
  init_fn = symbol<InitFn>("cactus_init");
  complete_fn = symbol<CompleteFn>("cactus_complete");
  shutdown_fn = symbol<ShutdownFn>("cactus_destroy");
  return init_fn && complete_fn && shutdown_fn;
}

jstring string_result(JNIEnv* env, const char* value) {
  return env->NewStringUTF(value ? value : "");
}

long resident_bytes() {
  std::ifstream input("/proc/self/statm");
  long ignored_total = 0, resident = 0;
  if (!(input >> ignored_total >> resident)) return -1;
  (void)ignored_total;
  return resident * sysconf(_SC_PAGESIZE);
}

std::string json_escape(const std::string& input) {
  std::string result;
  result.reserve(input.size() + 32);
  for (char value : input) {
    if (value == '\\' || value == '"') result.push_back('\\');
    if (value == '\n') { result += "\\n"; continue; }
    result.push_back(value);
  }
  return result;
}

std::string complete(const std::string& prompt) {
  if (!runtime || !complete_fn) return R"({"success":false,"error":"Needle runtime unavailable"})";
  const std::string messages = "[{\"role\":\"system\",\"content\":\"Return only the requested schema as JSON.\"},"
      "{\"role\":\"user\",\"content\":\"" + json_escape(prompt) + "\"}]";
  constexpr size_t response_size = 64 * 1024;
  std::string response(response_size, '\0');
  const char* options = R"({"max_tokens":2048,"temperature":0.1,"auto_handoff":false})";
  int status = complete_fn(runtime, messages.c_str(), response.data(), response.size(), options,
                           nullptr, nullptr, nullptr, nullptr, 0);
  if (status < 0) return R"({"success":false,"error":"cactus_complete failed"})";
  response.resize(strnlen(response.c_str(), response.size()));
  return response;
}
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_gritmap_karoo_ai_NeedleAgentManager_00024JniNeedleBridge_initNeedle(JNIEnv* env, jobject, jstring path) {
  std::lock_guard<std::mutex> lock(mutex);
  const char* chars = env->GetStringUTFChars(path, nullptr);
  struct stat info{};
  // Cactus v2 loads a model bundle directory, not a single opaque weight file.
  const bool readable = chars && stat(chars, &info) == 0 && S_ISDIR(info.st_mode);
  const bool loaded = readable && load_runtime();
  if (loaded && !runtime) runtime = init_fn(chars, nullptr, false);
  if (chars) env->ReleaseStringUTFChars(path, chars);
  return runtime ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_gritmap_karoo_ai_NeedleAgentManager_00024JniNeedleBridge_generatePlan(JNIEnv* env, jobject, jstring request) {
  std::lock_guard<std::mutex> lock(mutex);
  const char* chars = env->GetStringUTFChars(request, nullptr);
  const std::string result = complete(std::string("Create a contiguous pacing plan for this input: ") + chars);
  env->ReleaseStringUTFChars(request, chars);
  return string_result(env, result.c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_gritmap_karoo_ai_NeedleAgentManager_00024JniNeedleBridge_processTelemetry(JNIEnv* env, jobject, jfloatArray values) {
  std::lock_guard<std::mutex> lock(mutex);
  const jsize size = env->GetArrayLength(values);
  jfloat* data = env->GetFloatArrayElements(values, nullptr);
  std::string prompt = "Evaluate telemetry schema v1 values [";
  for (jsize i = 0; i < size; ++i) {
    if (i) prompt += ',';
    prompt += std::to_string(data[i]);
  }
  prompt += "] and return a concise structured recommendation.";
  env->ReleaseFloatArrayElements(values, data, JNI_ABORT);
  const std::string result = complete(prompt);
  return string_result(env, result.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_gritmap_karoo_ai_NeedleAgentManager_00024JniNeedleBridge_shutdownNeedle(JNIEnv*, jobject) {
  std::lock_guard<std::mutex> lock(mutex);
  if (runtime && shutdown_fn) shutdown_fn(runtime);
  runtime = nullptr;
}

extern "C" JNIEXPORT jlongArray JNICALL
Java_com_gritmap_karoo_ai_NeedleAgentManager_00024JniNeedleBridge_nativeMemoryStats(JNIEnv* env, jobject) {
  std::lock_guard<std::mutex> lock(mutex);
  // The public C ABI does not expose model-only allocation. Report it as unavailable,
  // separately from process RSS, instead of presenting RSS as model memory.
  const jlong values[] = {-1, static_cast<jlong>(resident_bytes())};
  jlongArray result = env->NewLongArray(2);
  env->SetLongArrayRegion(result, 0, 2, values);
  return result;
}
