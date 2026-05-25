# AOSP 分析 Skills 库使用指南

## 快速开始

### 安装方法

#### 方法一：GitHub Pages 引用（推荐）

在你的 opencode.json 中添加配置：

```json
{
  "skills": {
    "urls": ["https://your-username.github.io/aosp-analysis-skills/.well-known/skills/"]
  }
}
```

#### 方法二：本地克隆使用

```bash
# 克隆仓库
git clone https://github.com/your-username/aosp-analysis-skills.git ~/aosp-analysis-skills

# 在 opencode.json 中配置
{
  "skills": {
    "paths": ["~/aosp-analysis-skills/skills"]
  }
}
```

### 重启 opencode

重启 opencode 使配置生效。

## 使用示例

### 基础查询

```
分析 Activity 启动过程
→ 自动触发 aosp-activity-startup-flow

检查 WindowManagerService 初始化流程
→ 自动触发 aosp-wms-lifecycle
```

### 输入系统分析

```
输入事件是如何分发到应用的？
→ 自动触发 aosp-input-dispatching-analyzer

触摸事件是如何处理的？
→ 自动触发 aosp-input-event-processor
```

### 系统服务分析

```
后台进程被杀死的机制是什么？
→ 自动触发 aosp-background-kill-restrictions

系统栏是如何隐藏和显示的？
→ 自动触发 aosp-systembar-visibility
```

## 技能列表

### Activity 和生命周期
- **aosp-activity-startup-flow**: Activity 启动到 onCreate 流程分析

### 输入系统
- **aosp-input-event-processor**: 输入事件处理机制
- **aosp-input-dispatching-analyzer**: 输入事件分发与路由
- **aosp-input-ipc-transport**: 输入系统跨进程IPC通信

### 系统服务
- **aosp-wms-lifecycle**: WindowManagerService 生命周期
- **aosp-systembar-visibility**: 系统栏显示隐藏逻辑
- **aosp-background-kill-restrictions**: 后台杀进程和禁保活机制

### Framework 核心
- **aosp-framework-analyzer-v2**: Framework 源码综合分析
- **aosp-framework-event-flow**: Frameworks Native 事件处理流程
- **aosp-inputflinger-core-analyzer**: InputFlinger 核心服务架构

### 桌面模式
- **aosp-desktop-window-decor**: 桌面模式窗口装饰系统

### 主路由器
- **aosp-analyzer**: 智能路由和协调整个skills库

## 高级用法

### 多技能协同分析

当问题涉及多个系统组件时，aosp-analyzer 会自动协调多个专业技能：

```
输入系统从硬件到应用的完整流程
→ 协调 aosp-input-event-processor, aosp-input-dispatching-analyzer, aosp-input-ipc-transport
```

### 性能优化建议

使用性能相关关键词可获得优化建议：

```
优化 InputDispatcher 分发延迟
→ 提供性能分析和优化建议
```

### 问题诊断

包含"问题"、"错误"、"bug"等关键词可获得诊断帮助：

```
Activity 启动慢，如何诊断？
→ 提供性能分析和诊断步骤
```

## 版本兼容性

- **Android 版本**: 主要针对 Android 14 (API 34) 及以上版本
- **框架版本**: 支持 Android Framework 10-16
- **技能版本**: 每个技能都有独立版本标识

## 调试技巧

### 启用详细日志

```bash
# 查看 skill 触发日志
adb logcat | grep "skill"

# 查看搜索和分析过程
adb logcat | grep "analysis"
```

### 检查技能加载状态

```bash
# 查看已加载的技能
opencode skill list

# 测试特定技能
opencode skill test aosp-activity-startup-flow
```

## 进阶使用

### 自定义扩展

你可以基于现有技能创建自定义分析：

1. 从最相关的技能开始
2. 添加特定应用场景的分析
3. 集成到你的开发流程中

### 团队协作

团队成员可以：

1. 共享相同的技能配置
2. 贡献新的技能分析
3. 提供改进反馈
4. 维护技能库的更新

## 故障排除

### 技能未触发

检查：
1. opencode.json 配置是否正确
2. 技能路径是否正确
3. 关键词是否准确
4. opencode 是否重启

### 分析结果不理想

尝试：
1. 提供更多上下文信息
2. 使用更精确的类名和方法名
3. 拆分复杂查询
4. 指定 Android 版本

### 性能问题

优化：
1. 避免过于广泛的分析请求
2. 使用缓存的分析结果
3. 限制分析深度
4. 使用本地技能而非远程引用

## 最佳实践

### 1. 查询设计

- ✅ 使用准确的类名和方法名
- ✅ 提供足够的上下文信息
- ✅ 明确分析目的
- ✅ 指定 Android 版本

### 2. 学习路径

- 从基础流程开始
- 逐步深入复杂系统
- 关注性能和优化
- 学习问题诊断技巧

### 3. 贡献发展

- 分享有用的分析成果
- 报告问题和提供反馈
- 贡献新的技能
- 改进现有技能

## 更新和维护

### 技能更新

技能库会定期更新，包括：

- 新的专业技能
- 更新的分析内容
- 改进的触发生词
- 性能优化

### 保持最新

```bash
# 如果使用本地克隆
cd ~/aosp-analysis-skills
git pull origin main

# GitHub Pages 会自动更新
```

## 支持和反馈

- **报告问题**: GitHub Issues
- **功能请求**: GitHub Discussions  
- **贡献指南**: 查看 CONTRIBUTING.md
- **文档改进**: 提交 PR 或报告问题

## 相关资源

- [Android 开发者文档](https://developer.android.com/)
- [AOSP 源码](https://source.android.com/)
- [Android Framework 指南](https://source.android.com/docs/core/architecture)
- [OpenCode 文档](https://opencode.ai/docs)

---

**记住**: 这个技能库是为 Android 开发者和系统工程师设计的，专精于 AOSP 源码分析。充分利用它来加速你的开发和调试工作！