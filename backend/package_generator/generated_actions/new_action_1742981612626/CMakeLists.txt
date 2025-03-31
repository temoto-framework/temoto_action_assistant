cmake_minimum_required(VERSION 3.5)
project(new_action_1742981612626)

add_compile_options(-std=c++20)

# find dependencies
find_package(ament_cmake REQUIRED)
find_package(temoto_action_engine REQUIRED)
find_package(temoto_action_engine_ros2 REQUIRED)

add_library(${PROJECT_NAME} SHARED src/${PROJECT_NAME}.cpp)
target_include_directories(${PROJECT_NAME} PUBLIC
	$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
	$<INSTALL_INTERFACE:include>
)

target_link_libraries(${PROJECT_NAME} temoto_action_engine)

ament_target_dependencies(${PROJECT_NAME}
	temoto_action_engine_ros2
)

install(TARGETS ${PROJECT_NAME} DESTINATION lib)

ament_package()