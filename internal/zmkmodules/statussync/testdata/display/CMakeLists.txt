# SPDX-License-Identifier: MIT
cmake_minimum_required(VERSION 3.20.0)
# Keep this smoke test independent of the personal zmk-config west module.
set(ZEPHYR_MODULES "$ENV{ZEPHYR_BASE}/../modules/lib/gui/lvgl;$ENV{ZEPHYR_BASE}/../modules/hal/cmsis")
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(zmapflow_display_smoke)
target_sources(app PRIVATE main.c ../../module/screen.c)
target_include_directories(app PRIVATE include ../../module/include)
