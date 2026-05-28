---
name: aosp-surfaceflinger-core
description: 专精 Android SurfaceFlinger 整体架构、初始化流程、合成流水线分析。用户提到 SurfaceFlinger、composition pipeline、合成流水线、commit composite present、compositionEngine、DisplayDevice、Layer lifecycle、init scheduler、HWC HAL、帧合成、RenderEngine 等关键词时自动触发。
keywords:
  - SurfaceFlinger
  - composition pipeline
  - 合成流水线
  - compositionEngine
  - commit composite present
  - DisplayDevice
  - Layer
  - RenderEngine
  - HWComposer
  - init scheduler
  - frame composition
  - surfaceflinger init
  - surfaceflinger run
version: "1.0.0"
author: "AOSP Analysis Team"
---

# SurfaceFlinger 核心架构与运行流程

基于 `lineageos_android_frameworks_native/services/surfaceflinger/` 源码分析。

## 核心结论

SurfaceFlinger 是 Android 图形系统的核心守护进程（system 进程），负责将所有应用窗口（Surface/Layer）合成到显示器上。它通过 VSync 驱动的帧流水线，协调 GPU 合成（RenderEngine）和硬件合成（HWComposer HAL），最终将多个图层混合输出到物理显示器。

## 源码位置

```
services/surfaceflinger/
├── main_surfaceflinger.cpp        ← 进程入口
├── SurfaceFlinger.h/.cpp          ← 核心类 (10363+ 行)
├── SurfaceFlingerFactory.h/.cpp   ← 工厂模式创建子组件
├── Layer.h/.cpp                   ← 窗口层抽象
├── DisplayDevice.h/.cpp           ← 显示设备抽象
├── CompositionEngine/             ← 合成引擎抽象 (GPU/HWC 调度)
├── Scheduler/                     ← 主线程消息循环 + VSync + 刷新率
├── DisplayHardware/               ← HWComposer HAL 封装 (AIDL/HIDL)
├── FrontEnd/                      ← 新 Layer 前端系统
├── FrameTimeline/                 ← 帧时间线追踪
├── Effects/                       ← 颜色效果 (色盲校正等)
├── Tracing/                       ← Transaction/Layer 追踪
├── TimeStats/                     ← 性能统计
└── tests/                         ← 单元/集成测试
```

---

## 架构总览 (6 大模块)

```
SurfaceFlinger (核心类)
├── CompositionEngine      ← 合成引擎 (GPU/HWC 合成调度)
│   ├── Display            ← 合成显示器
│   ├── Output             ← 合成输出
│   ├── OutputLayer        ← 每 Layer 输出状态
│   ├── RenderSurface      ← GPU 合成渲染面
│   └── DisplayColorProfile ← 颜色配置
├── Scheduler              ← VSync + 刷新率 + 消息循环
│   ├── MessageQueue       ← Looper 消息队列
│   ├── EventThread        ← App VSync 事件分发
│   ├── RefreshRateSelector ← 刷新率选择策略
│   └── VsyncSchedule      ← VSync 调度管理
├── DisplayHardware        ← HWC HAL 封装
│   ├── HWComposer         ← HWC 抽象层
│   ├── ComposerHal        ← HAL 接口适配 (AIDL/HIDL)
│   └── PowerAdvisor       ← 电源管理集成
├── FrontEnd               ← 新 Layer 前端系统
│   ├── LayerLifecycleManager ← Layer 生命周期
│   ├── LayerSnapshotBuilder ← 不可变快照构建
│   └── TransactionHandler ← 事务排队处理
├── Layer                  ← 窗口层抽象
└── DisplayDevice          ← 显示设备抽象
```

---

## 进程入口与初始化流程

**文件**: `main_surfaceflinger.cpp`

```
main()
├── signal(SIGPIPE, SIG_IGN)                       // 忽略管道断开信号
├── configureRpcThreadpool(1)                       // HIDL RPC 线程池
├── startGraphicsAllocatorService()                 // 启动图形内存分配器 HAL
├── setThreadPoolMaxThreadCount(4)                  // Binder 线程池限制 4 线程
├── sched_setscheduler(SCHED_FIFO, prio=1)          // Binder 线程实时优先级
├── ProcessState::startThreadPool()                 // 启动 Binder 线程池
├── createSurfaceFlinger()                          // 工厂模式创建 SF 实例
├── setpriority(PRIORITY_PROCESS, PRIORITY_URGENT_DISPLAY)
├── flinger->init()                                 // ★ 核心初始化
├── sm->addService("SurfaceFlinger", ...)           // 注册 Binder 服务
├── sm->addService("SurfaceFlingerAIDL", ...)       // 注册 AIDL 服务
├── startDisplayService()                           // 启动 DisplayService
└── flinger->run()                                  // ★ 进入主循环
```

### init() 详细流程

**文件**: `SurfaceFlinger.cpp:831`

```
SurfaceFlinger::init()
├── addTransactionReadyFilters()            // 注册事务就绪过滤器
├── RenderEngine::create()                  // 创建 GPU 渲染引擎
├── SetTaskProfiles("SFMainPolicy")         // 设置主线程任务配置
├── createHWComposer()                      // 创建 HWC HAL 封装
├── configureLocked()                       // 处理启动时的 hotplug 事件
├── processDisplayAdded()                   // 提交主显示器到 current/drawing state
├── initScheduler(display)                  // ★ 创建调度器
│   ├── new Scheduler(compositor, callback, features)
│   ├── registerDisplay(pacesetter)                 // 注册 pacesetter 显示器
│   ├── createEventThread(Cycle::Render)             // App 渲染 VSync 事件线程
│   ├── createEventThread(Cycle::LastComposite)      // 合成前 VSync 事件线程
│   ├── initVsync(TokenManager, workDuration)        // VSync 调度初始化
│   └── startTimers()                                // 启动触摸/电源定时器
├── processDisplayChangesLocked()           // 提交副显示器
├── mDrawingState = mCurrentState           // 同步绘制状态
├── onActiveDisplayChangedLocked()          // 通知活跃显示器变更
├── initializeDisplays()                    // 显示器初始化
├── mPowerAdvisor->init()                   // 电源管理初始化
├── RenderEngine::primeCache()              // 预编译着色器缓存
└── StartPropertySetThread()                // 设置 present fence 属性
```

---

## SurfaceFlinger 类结构

**文件**: `SurfaceFlinger.h:196-202`

```cpp
class SurfaceFlinger :
    public BnSurfaceComposer,              // Binder 服务端 (旧接口)
    public PriorityDumper,                 // dumpsys 支持
    private IBinder::DeathRecipient,       // 监听 WMS 死亡
    private HWC2::ComposerCallback,        // HWC HAL 回调
    private ICompositor,                   // ★ 合成接口 (Scheduler 驱动)
    private scheduler::ISchedulerCallback, // Scheduler 回调
    private compositionengine::ICEPowerCallback  // 电源回调
```

### 核心内部类 State (双层状态机)

```cpp
class State {
    LayerVector layersSortedByZ;              // Z 序排列的 Layer
    DefaultKeyedVector<wp<IBinder>, DisplayDeviceState> displays;  // 显示器列表
    mat4 colorMatrix;                         // 全局颜色矩阵
    ShadowSettings globalShadowSettings;      // 全局阴影设置
};
// 两个实例:
// mCurrentState  — Binder 线程写入
// mDrawingState  — 主线程 latched, 只读
```

### 事务标志位

```
eTransactionNeeded          = 0x01  // 有待处理事务
eTraversalNeeded            = 0x02  // 需要遍历 Layer 树
eDisplayTransactionNeeded   = 0x04  // 显示器变更待处理
eTransformHintUpdateNeeded  = 0x08  // 变换提示更新
eTransactionFlushNeeded     = 0x10  // 事务需要冲刷
eInputInfoUpdateNeeded      = 0x20  // 输入信息更新
```

---

## 每帧合成流水线 (最核心流程)

VSync 信号驱动完整流水线: **configure → commit → composite → present → sample**

### ICompositor 接口 (驱动合成流水线)

**文件**: `SurfaceFlinger.h:672-680`

```cpp
void configure();                             // 处理显示器变更
bool commit(PhysicalDisplayId, FrameTargets&);// 事务提交 + 锁存缓冲区
CompositeResultsPerDisplay composite(...);    // 执行合成 (HWC+GPU)
void sample();                                // 区域采样 (可选)
```

### configure() — `SurfaceFlinger.cpp:2239`

```cpp
void SurfaceFlinger::configure() {
    Mutex::Autolock lock(mStateLock);
    if (configureLocked()) {  // 处理 pending hotplug 事件
        setTransactionFlags(eDisplayTransactionNeeded);
    }
}
```

### commit() — `SurfaceFlinger.cpp:2517`

```
SurfaceFlinger::commit()
├── 检查 mode set pending (跳过本次提交)
├── finalizeDisplayModeChange (完成刷新率切换)
├── 检查 backpressure (HWC 上一帧未完成 → 跳过)
├── mPowerAdvisor->setCommitStart / setExpectedPresentTime
├── updateLayerSnapshots() / updateLayerSnapshotsLegacy()
│   ├── mTransactionHandler.flushTransactions()     // 冲刷 Binder 排队事务
│   ├── mTransactionHandler.collectTransactions()   // 收集事务
│   ├── mLayerLifecycleManager.addLayers()          // 添加新 Layer
│   ├── mLayerLifecycleManager.applyTransactions()  // 应用事务到 Layer
│   ├── mLayerSnapshotBuilder.update()              // 构建不可变快照
│   ├── applyTransactions()                         // 应用回调
│   ├── commitTransaction()  [每个 Layer]            // 提交 Layer 事务
│   └── latchBuffers() / updateLayerGeometry()      // 锁存缓冲区/更新几何
├── TransactionCallbackInvoker::sendCallbacks()    // 事务回调
├── chooseRefreshRateForContent()                   // 选择最佳刷新率
├── initiateDisplayModeChanges()                    // 发起刷新率切换
├── updateCursorAsync()                             // 异步更新光标
├── updateInputFlinger(vsyncId, frameTime)          // 更新 InputFlinger
└── persistDisplayBrightness()                      // 持久化亮度
```

### composite() — `SurfaceFlinger.cpp:2669`

```
SurfaceFlinger::composite()
├── 构建 CompositionRefreshArgs
│   ├── outputs: 物理显示器 + 虚拟显示器
│   ├── frameTargets: 每显示器 FrameTarget
│   ├── colorTransformMatrix / outputColorSetting
│   ├── layersWithQueuedFrames / bufferIdsToUncache
│   └── frameInterval / scheduledFrameTime
├── moveSnapshotsToCompositionArgs()
├── mCompositionEngine->present(refreshArgs)    // ★ 核心合成
│   ├── preComposition()  [每个 Display]
│   │   └── 收集 HWC 渐变/模糊/圆角状态
│   ├── Output::present() [每个 Display]
│   │   ├── HWC::validateDisplay()       // ★ HAL 决定合成策略
│   │   │   ├── CLIENT  → GPU 合成
│   │   │   ├── DEVICE  → HWC 硬件合成
│   │   │   └── SOLID_COLOR → 纯色
│   │   ├── if (GPU layers):
│   │   │   └── RenderEngine::drawLayers()  // GLES/Vulkan GPU 合成
│   │   └── HWC::presentDisplay()           // 提交到显示硬件
│   └── moveSnapshotsFromCompositionArgs()  // 回收快照
├── Layer::onLayerDisplayed() [每个 Layer]   // 释放缓冲区
├── Layer::setWasClientComposed()            // 标记 GPU 合成
└── mTimeStats->recordFrameDuration()        // 记录帧耗时
```

---

## CompositionEngine 模块架构

**文件**: `CompositionEngine/include/compositionengine/CompositionEngine.h`

```
CompositionEngine::present(CompositionRefreshArgs)
├── preComposition()
│   └── for each Display::Output:
│       └── OutputLayer::prepare() — 设置 HWC 属性
├── for each Display:
│   └── Output::present()
│       ├── 收集 outputLayers (按 Z 序)
│       ├── HWC::validateDisplay()  ←── HAL 调用 返回合成策略
│       │   └── 给每个 layer 分配类型:
│       │       CLIENT / DEVICE / SOLID_COLOR / CURSOR / SIDEBAND
│       ├── 如果需要 GPU 合成:
│       │   ├── RenderSurface::beginFrame()  (绑定 FBO)
│       │   ├── RenderEngine::drawLayers()   (逐个绘制)
│       │   └── RenderSurface::queueBuffer() (提交到 BufferQueue)
│       ├── HWC::presentDisplay()             ←── 最终提交
│       └── DisplaySurface::advanceFrame()
└── postComposition()
    └── Layer::onLayerDisplayed() — 通知 Layer 释放 buffer
```

---

## Display 管理

```
HWC HAL hotplug 事件:
    onComposerHalHotplugEvent()
    └── mPendingHotplugEvents 排队
        └── configureLocked() 中处理
            └── processHotplug() — 决定接受/拒绝
                └── processDisplayChangesLocked()
                    ├── 新增显示器:
                    │   └── setupNewDisplayDeviceInternal()
                    │       ├── 创建 CompositionEngine::Display
                    │       ├── 创建 DisplayDevice
                    │       ├── Scheduler::registerDisplay()
                    │       └── 通知 InputFlinger
                    ├── 移除显示器:
                    │   └── processDisplayRemoved()
                    └── 变更显示器:
                        └── processDisplayChanged()
```

---

## 线程模型

| 线程 | 职责 |
|------|------|
| **Main Thread** | SurfaceFlinger 主循环 执行 commit + composite |
| **Binder Threads (≤4)** | 处理客户端 IPC (setTransactionState 等) |
| **EventThread (Render)** | 向 App 分发 VSync 事件 (通过 BitTube IPC) |
| **EventThread (LastComposite)** | 向客户端分发合成前 VSync 事件 |
| **HWC Async Worker** | 异步执行 HWC validate (预判合成策略) |
| **RegionSamplingThread** | 屏幕区域颜色采样 |

---

## 整体数据流

```
┌──────────┐    Binder IPC     ┌───────────────────┐
│ WMS/App  │ ─────────────────→│ SurfaceFlinger    │
│ (Client) │  setTransaction   │                   │
└──────────┘                   │  TransactionQueue │
                               │       │           │
                               │  commitTransactions│
                               │       │           │
┌──────────┐  BufferQueue      │  latchBuffers     │
│ App GPU  │ ─────────────────→│       │           │
│ (Render) │  queueBuffer      │  Layer Snapshots  │
└──────────┘                   │       │           │
                               │  CompositionEngine│
                               │   ├── HWC Validate│←── HWC HAL
                               │   └── GPU Compose │←── RenderEngine
                               │       │           │
                               │  HWC Present      │──→ Hardware Display
                               └───────────────────┘
```

---

## 调试与排查

```bash
# 查看 SurfaceFlinger 状态
dumpsys SurfaceFlinger

# 查看 layer 列表
dumpsys SurfaceFlinger --list

# 查看合成策略 (HWC vs GPU)
dumpsys SurfaceFlinger --latency <layer_name>

# 帧率分析
dumpsys gfxinfo <package_name>

# 打开合成调试闪屏
service call SurfaceFlinger 1008 i32 1

# systrace 追踪
atrace -t 10 -b 32768 gfx view wm
```

---

**此 Skill 由 opencode 分析生成，可持续累积。**
