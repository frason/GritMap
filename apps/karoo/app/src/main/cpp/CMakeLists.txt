cmake_minimum_required(VERSION 3.22.1)
project(gritmap_needle_bridge LANGUAGES CXX)

add_library(gritmap_needle_bridge SHARED native-lib.cpp)
target_compile_features(gritmap_needle_bridge PRIVATE cxx_std_20)
target_link_libraries(gritmap_needle_bridge PRIVATE android log dl)

