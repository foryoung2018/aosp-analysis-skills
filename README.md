# AOSP Analysis Skills

专精 Android AOSP Framework 源码分析的 OpenCode Skills 中文库

## 简介

这是一个为 Android 系统开发者、ROM 制作者和系统工程师设计的专精 Skill 库，包含针对 Android 14 (APK 34) LineageOS Framework 源码的深度分析技能。

## 功能特性

- 🎯 **智能触发**: 根据用户查询的关键词自动触发对应的专业分析能力
- 🔍 **深度分析**: 提供 Framework 层级的完整代码流程、调用链和架构分析
- 🏗️ **架构理解**: 帮助理解复杂的系统服务、Binder 通信、事件分发等核心机制
- 🚀 **定制支持**: 支持系统功能定制、修改和优化工作
- 📊 **可视化**: 详细的调用链图表和架构说明

## 包含的 Skill 模块

### 🎯 Activity 启动流程
- `activity/startup-flow` - Activity 从 startActivity 到 onCreate 的完整流程分析

### 🔌 输入事件系统
- `input/dispatching` - 输入事件分发与路由机制
- `input/event-processor` - 输入事件处理机制
- `input/ipc-transport` - 输入系统跨进程 IPC 通信

### 🖥️ 系统服务
- `system/wms-lifecycle` - WindowManagerService 生命周期分析
- `system/systembar-visibility` - 状态栏和导航栏显示隐藏逻辑
- `system/background-kill` - 后台进程管理、lmkd、oom_adj 机制

### 🏛️ Framework 核心
- `framework/analyzer` - AOSP framework/base 源码通用分析
- `framework/event-flow` - Frameworks Native 事件处理流程
- `framework/native` - Frameworks Native 架构分析

### 🖼️ 桌面模式
- `desktop/window-decor` - 桌面模式窗口装饰系统

## 安装使用

### 方法一：npm 安装（推荐）

```bash
npm install -g aosp-analysis-skills
```

安装后自动将 skills 复制到 `~/.config/opencode/skills/` 目录，立即可用。

### 方法二：GitHub Pages 引用

1. 在你的 opencode.json 中添加配置：

```json
{
  "skills": {
    "urls": ["https://foryoung2018.github.io/aosp-analysis-skills/.well-known/skills/"]
  }
}
```

2. 重启 opencode 使配置生效

### 方法三：本地克隆

1. 克隆仓库到本地：

```bash
git clone https://github.com/foryoung2018/aosp-analysis-skills.git ~/aosp-analysis-skills
```

2. 在 opencode.json 中配置本地路径：

```json
{
  "skills": {
    "paths": ["~/aosp-analysis-skills/skills"]
  }
}
```

## 使用示例

当你在 Android Framework 项目中工作时，这些 skills 会自动触发：

```
分析 Activity 启动过程                # 自动触发 activity-startup-flow
检查 WindowManagerService 初始化流程   # 自动触发 wms-lifecycle  
输入事件是如何分发到应用的？          # 自动触发 input-dispatching
后台进程被杀死的机制是什么？          # 自动触发 background-kill-restrictions
```

## 项目结构

```
aosp-analysis-skills/
├── skills/                    # 所有 skill 源码
│   ├── activity/
│   ├── input/
│   ├── system/
│   ├── framework/
│   └── desktop/
├── .well-known/skills/        # GitHub Pages 端点
├── _site/                     # 构建输出目录
├── tools/                     # 工具脚本
├── docs/                      # 详细文档
├── build.js                   # 构建脚本
├── package.json
└── README.md
```

## 版本管理

- 遵循语义化版本规范
- 每个 skill 独立版本控制
- 主仓库统一版本发布

## 贡献指南

欢迎贡献新的技能或改进现有技能！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/your-skill`)
3. 按照现有规范创建新的 skill
4. 提交更改 (`git commit -am 'Add new skill'`)
5. 推送到分支 (`git push origin feature/your-skill`)
6. 创建 Pull Request

## 技术支持

- 📖 完整文档: [docs/](./docs/)
- 🐛 问题反馈: [GitHub Issues](https://github.com/your-username/aosp-analysis-skills/issues)
- 💬 讨论交流: [GitHub Discussions](https://github.com/your-username/aosp-analysis-skills/discussions)

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 致谢

基于 OpenCode 框架开发，感谢所有贡献者的支持！

---

**专注于 Android 源码深度分析，助您轻松掌握系统架构** 🚀