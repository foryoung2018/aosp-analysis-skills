# Changelog

All notable changes to AOSP Analysis Skills will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-05-28

### Added
- **aosp-surfaceflinger-core**: SurfaceFlinger 整体架构、初始化流程、合成流水线分析
- **aosp-surfaceflinger-vsync**: VSync 调度算法 (线性回归预测、定时器调度、相位调制)

## [1.0.0] - 2024-05-25

### Added
- Initial release of AOSP Analysis Skills library
- 12 specialized skills for Android framework analysis
- Intelligent routing system (aosp-analyzer)
- GitHub Pages integration for easy access
- Comprehensive documentation and usage guide

### Skills Included
- **aosp-activity-startup-flow**: Activity 启动到 onCreate 流程分析
- **aosp-input-event-processor**: 输入事件处理机制
- **aosp-input-dispatching-analyzer**: 输入事件分发与路由机制
- **aosp-input-ipc-transport**: 输入系统跨进程IPC通信
- **aosp-wms-lifecycle**: WindowManagerService 生命周期分析
- **aosp-systembar-visibility**: 系统栏显示隐藏逻辑分析
- **aosp-background-kill-restrictions**: 后台杀进程和禁保活机制
- **aosp-framework-analyzer-v2**: Framework 源码综合分析
- **aosp-framework-event-flow**: Frameworks Native 事件处理流程
- **aosp-native-framework-analyzer**: Frameworks Native 架构分析
- **aosp-desktop-window-decor**: 桌面模式窗口装饰系统分析
- **aosp-inputflinger-core-analyzer**: InputFlinger 核心服务架构分析

### Documentation
- Complete README with architecture overview
- Usage guide with examples and best practices
- Build and deployment workflows for GitHub Pages
- Contribution guidelines

### Technical Features
- Intelligent query routing and skill matching
- Multi-skill coordination for complex analyses
- Knowledge accumulation mechanism
- Performance optimization and caching
- Comprehensive error handling and troubleshooting