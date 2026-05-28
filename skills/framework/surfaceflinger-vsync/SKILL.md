---
name: aosp-surfaceflinger-vsync
description: 专精 Android SurfaceFlinger VSync 调度算法与机制分析。用户提到 VSync 调度、VsyncSchedule、VSyncPredictor、VSyncReactor、VSyncDispatchTimerQueue、VsyncModulator、VsyncConfiguration、EventThread、vsyncCallback、线性回归预测、phase offset、render rate 对齐、VSync 去向、VSync 开关等关键词时自动触发。
keywords:
  - VSync
  - VsyncSchedule
  - VSyncPredictor
  - VSyncReactor
  - VSyncDispatchTimerQueue
  - VsyncModulator
  - VsyncConfiguration
  - EventThread
  - vsyncCallback
  - 线性回归预测
  - phase offset
  - render rate
  - VSync 调度
  - VSync 开关
  - present fence
  - SF 主线程唤醒
version: "1.0.0"
author: "AOSP Analysis Team"
---

# SurfaceFlinger VSync 调度算法

基于 `lineageos_android_frameworks_native/services/surfaceflinger/Scheduler/` 源码深入分析。

## 核心结论

VSync 调度系统是 SurfaceFlinger 帧合成的节拍器。它通过**线性回归模型预测未来 VSync 信号时间**，利用**定时器队列精确调度回调**，为 SF 主线程和 App 渲染线程提供相位对齐的唤醒信号。

## 源码位置

```
Scheduler/
├── VsyncSchedule.h/.cpp         ← 每显示器调度实例 (Tracker+Dispatch+Controller)
├── VSyncReactor.h/.cpp          ← 采样验证 + 周期确认状态机
├── VSyncPredictor.h/.cpp        ← 线性回归预测模型
├── VSyncDispatchTimerQueue.h/.cpp  ← 定时器回调调度队列
├── VSyncDispatch.h              ← VSyncDispatch 接口 + ScheduleResult
├── VSyncTracker.h               ← VSyncTracker 接口 (预测模型)
├── VsyncController.h            ← VsyncController 接口 (采样控制)
├── VsyncModulator.h/.cpp        ← 相位偏移动态调制
├── VsyncConfiguration.h/.cpp    ← 相位配置计算
├── MessageQueue.h/.cpp          ← SF 主线程消息队列 + VSync 入口
├── EventThread.h/.cpp           ← App VSync 事件分发线程
└── include/scheduler/
    └── VsyncConfig.h            ← VsyncConfig 数据结构
```

---

## 整体数据流

```
硬件 VSYNC 中断
    │
    ▼
HWC HAL ── onComposerHalVsync(timestamp, period) ──►

┌─────────────── VsyncSchedule (per display) ─────────────────────────────┐
│                                                                           │
│  ┌──────────────────┐    ┌────────────────────┐                          │
│  │  VSyncReactor     │───▶│  VSyncPredictor    │                          │
│  │  采样过滤+周期确认  │    │  线性回归预测模型    │                          │
│  └──────────────────┘    └────────┬───────────┘                          │
│                                   │ nextAnticipatedVSyncTimeFrom()       │
│                                   ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │  VSyncDispatchTimerQueue (共享硬件定时器)                              ││
│  │                                                                        ││
│  │  callback#1: MessageQueue::vsyncCallback  ──► SF 主线程 wakeup        ││
│  │  callback#2: EventThread(Render)::onVsync  ──► App 开始渲染           ││
│  │  callback#3: EventThread(LastComposite)::onVsync                      ││
│  └──────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 1. VsyncSchedule — 每显示器调度总控

**文件**: `VsyncSchedule.h:56`

```cpp
class VsyncSchedule final : public IVsyncSource {
    TrackerPtr    mTracker;      // VSyncPredictor — 预测模型
    DispatchPtr   mDispatch;     // VSyncDispatchTimerQueue — 定时器回调队列
    ControllerPtr mController;   // VSyncReactor — 采样验证
    HwVsyncState  mHwVsyncState; // Enabled / Disabled / Disallowed
    RequestHardwareVsync mRequestHardwareVsync;  // 开关硬件 VSync 回调
};
```

### 创建参数 (`VsyncSchedule.cpp:117-150`)

```cpp
createTracker():
    kHistorySize = 20               // 环形缓冲区大小
    kMinSamplesForPrediction = 6    // 最小预测样本数
    kOutlierTolerancePercent = 20%  // 离群值容忍度

createDispatch():
    kGroupDispatchWithin = 500us    // 相近回调合并窗口
    kSnapToSameVsyncWithin = 3ms    // 同一 VSync 判重窗口

createController():
    kMaxPendingFences = 20          // 最大待确认 present fence 数
```

### 硬件 VSync 状态机 (`VsyncSchedule.cpp:179-213`)

```
  Enabled ── disableHardwareVsync(false) ──► Disabled
  Disabled ── enableHardwareVsync() ──► Enabled
  * ── disableHardwareVsync(true) ──► Disallowed (不允许开启)
  Disallowed ── isHardwareVsyncAllowed(true) ──► Disabled (解除禁止)
```

### addResyncSample (`VsyncSchedule.cpp:159`)

```cpp
bool addResyncSample(timestamp, hwcVsyncPeriod) {
    // 1. 交给 VSyncReactor 验证
    needsHwVsync = mController->addHwVsyncTimestamp(timestamp, hwcVsyncPeriod, &periodFlushed);
    // 2. periodFlushed = true → Dispatch 的 tracker 已更新为新周期模型
    // 3. 按需开关硬件 VSync
    if (needsHwVsync) enableHardwareVsync();
    else disableHardwareVsync(false);
}
```

---

## 2. VSyncReactor — 周期确认状态机

**文件**: `VSyncReactor.cpp`

### 状态机

```
┌──────────┐   onDisplayModeChanged()      ┌──────────────────────┐
│  Normal   │ ─────────────────────────────►│  PeriodConfirmation   │
│ (稳定跟踪) │ ◄─────────────────────────────│  (周期确认中, 需要     │
└──────────┘   periodConfirmed()==true      │   更多 HW VSync 样本)  │
                                            └──────────────────────┘
```

### periodConfirmed 算法 (`VSyncReactor.cpp:154`)

```cpp
bool periodConfirmed(vsync_timestamp, hwcVsyncPeriod) {
    // 方式1: HWC 直接报告了 VsyncPeriod
    //   容忍度 10%: |hwcVsyncPeriod - targetPeriod| < allowance
    if (hwcVsyncPeriod) return abs(*hwcVsyncPeriod - period) < allowance;

    // 方式2: 连续两次 HW VSync 时间差
    //   容忍度 10%: |(timestamp₂ - timestamp₁) - targetPeriod| < allowance
    auto distance = vsync_timestamp - *mLastHwVsync;
    return abs(distance - period) < allowance;
}
```

DOZE 模式下直接返回 true。

### present fence 处理 (`VSyncReactor.cpp:55`)

```
addPresentFence(fence):
    // 遍历 mUnfiredFences, 收集已 signaled 的 fence
    for (f in mUnfiredFences):
        if signaled → mTracker.addVsyncTimestamp(time)
        if invalid → 移除
    // 新 fence: pending → push (最多 20 个); signaled → 直接采样
    // 任何 sample 被拒绝 → setIgnorePresentFences(true) + 重新确认周期
```

---

## 3. VSyncPredictor — 线性回归预测模型

**文件**: `VSyncPredictor.cpp`

### 模型定义

```
模型: Y = slope × X + intercept

  Y  = 预测的 VSync 时间戳
  X  = VSync 序数 (snap 到理想周期)
  slope     ≈ 实际 VSync 周期 (线性回归)
  intercept = 时间基准偏移
```

### 3.1 样本验证 (`VSyncPredictor.cpp:79`)

```cpp
bool validate(timestamp) {
    // 检查1: 相位对齐 — 必须在周期整数倍 ±20% 范围内
    percent = (timestamp - lastValid) % idealPeriod * 100 / idealPeriod;
    if (percent >= 20% && percent <= 80%) return false;

    // 检查2: 重复样本 — 与已有样本距离 > 20%
    if (distancePercent < 20%) return false;
}
```

### 3.2 线性回归计算 (`VSyncPredictor.cpp:163-246`)

```
已知:
  Xi = 样本 i 的 ordinal (定点缩放 ×1000)
  Yi = 样本 i 归一化到 oldestTimestamp

计算:
  X̄ = Σ(Xi) / n,  Ȳ = Σ(Yi) / n
  top    = Σ((Xi - X̄) * (Yi - Ȳ))
  bottom = Σ((Xi - X̄)²)
  slope     = top × 1000 / bottom
  intercept = Ȳ - slope × X̄ / 1000

验证: |slope - idealPeriod| < 20% × idealPeriod
      否则丢弃模型, 重新学习
```

### 3.3 预测未来 VSync (`VSyncPredictor.cpp:264-298`)

```cpp
nsecs_t snapToVsync(timePoint) {
    // 无样本: mKnownTimestamp + N × idealPeriod
    if (mTimestamps.empty())
        return mKnownTimestamp + numPeriods × idealPeriod;

    // 有样本: 线性回归模型
    zeroPoint = oldestTimestamp + intercept;
    ordinal   = (timePoint - zeroPoint + slope) / slope;
    prediction = ordinal × slope + intercept + oldestTimestamp;
    // 保证 prediction >= timePoint
    return prediction;
}
```

### 3.4 Render Rate 对齐 (`VSyncPredictor.cpp:316-346`)

120Hz 显示器只渲染 60Hz 时，只在对齐的 VSync 上唤醒:

```cpp
snapToVsyncAlignedWithRenderRate(timePoint) {
    vsyncSequence = getVsyncSequenceLocked(timePoint);
    divisor = getFrameRateDivisor(refreshRateFps, renderRate);  // 120/60=2
    mod = vsyncSequence.seq % divisor;
    if (mod != 0) {
        phase = divisor - mod;     // 跳到下个对齐的 VSync
        return snapToVsync(nextVsync + slope × phase);
    }
    return vsyncSequence.vsyncTime;
}
```

### 3.5 VRR minFramePeriod 保护 (`VSyncPredictor.cpp:418-501`)

```
ensureMinFrameDurationIsKept():
    确保连续帧预期呈现时间 >= minFramePeriod
    违规时将 expectedPresentTime 推到合规位置
```

---

## 4. VSyncDispatchTimerQueue — 定时器回调调度

**文件**: `VSyncDispatchTimerQueue.cpp`

### 调度原理

使用**单个硬件定时器**调度所有回调:

```
schedule(callback, timing):
    1. 计算下一个 VSync:
       nextVsync = tracker.nextAnticipatedVSyncTimeFrom(
           max(timing.lastVsync, now + workDuration + readyDuration))
    2. 计算唤醒时间:
       wakeupTime = nextVsync - workDuration - readyDuration
    3. 防跳过: wouldSkipAVsyncTarget / wouldSkipAWakeup
    4. adjustVsyncIfNeeded() 防重复/防过密
    5. 新 wakeupTime < 当前定时器 → rearmTimer()
```

### adjustVsyncIfNeeded (`VSyncDispatchTimerQueue.cpp:134`)

```cpp
adjustVsyncIfNeeded(tracker, nextVsyncTime) {
    if (alreadyDispatchedForVsync)
        return nextFrom(mLastDispatchTime + minVsyncDistance);  // 跳到下一帧
    if (距离上次调度 < 1 period)
        return nextFrom(mLastDispatchTime + currentPeriod);     // 跳到 N+1
    return nextVsyncTime;
}
```

### 三个注册的回调

| 回调 | workDuration | readyDuration | 用途 |
|------|-------------|---------------|------|
| **SF MainThread** | sfWorkDuration | 0 | SF 执行 commit+composite |
| **EventThread(Render)** | appWorkDuration | sfWorkDuration | App 开始渲染 |
| **EventThread(LastComposite)** | 0 | sfWorkDuration | 合成前通知客户端 |

### ScheduleTiming 语义 (`VSyncDispatch.h:100`)

```cpp
struct ScheduleTiming {
    nsecs_t workDuration;   // 客户端处理 buffer 用时
    nsecs_t readyDuration;  // SF 处理客户端 buffer 额外用时
    nsecs_t lastVsync;      // 目标呈现时间参考点
};
// 回调触发 = nextPredictedVsync - workDuration - readyDuration
```

---

## 5. MessageQueue — SF 主线程 VSync 入口

**文件**: `MessageQueue.cpp`

```cpp
void vsyncCallback(vsyncTime, targetWakeupTime, readyTime) {
    mVsync.value = (mVsync.value + 1) % 2;  // systrace 交替标记
    vsyncId = tokenManager->generateTokenForPredictions({...});
    mHandler->dispatchFrame(vsyncId, expectedVsyncTime);
}

// 去重: atomic bool 防止帧堆积
void Handler::dispatchFrame(vsyncId, time) {
    if (!mFramePending.exchange(true)) {  // 只有上一帧处理完才接收
        mLooper->sendMessage(this);
    }
}

void Handler::handleMessage() {
    mFramePending.store(false);
    mQueue.onFrameSignal(compositor, vsyncId, time);
    // → Scheduler::onFrameSignal() → configure→commit→composite
}
```

---

## 6. VsyncModulator — 相位偏移动态调制

**文件**: `VsyncModulator.cpp`

### 三种相位配置

```
            ┌──────────┐
            │  Late    │  ← 默认: 完整延迟 最低功耗
            └────┬─────┘
                 │ setTransactionSchedule(EarlyStart)
                 │ 或 onRefreshRateChangeInitiated()
                 ▼
            ┌──────────┐
            │  Early   │  ← SF+App 都提前 (事务/刷新率切换)
            └────┬─────┘
                 │ onDisplayRefresh(usedGpuComposition=true)
                 ▼
            ┌──────────┐
            │ EarlyGpu │  ← 仅 SF 提前 (GPU 合成需要额外时间)
            └──────────┘
```

### 状态选择 (`VsyncModulator.cpp:137`)

```cpp
getNextVsyncConfigType() {
    if (mEarlyWakeup非空 || mEarlyTransactionFrames>0 || mRefreshRateChangePending)
        return Early;
    if (mEarlyGpuFrames > 0) return EarlyGpu;
    return Late;
}
// 帧计数倒数 (低通滤波器):
// MIN_EARLY_TRANSACTION_FRAMES = 2
// MIN_EARLY_GPU_FRAMES = 2
```

---

## 7. VsyncConfiguration — 相位配置计算

**文件**: `VsyncConfiguration.cpp`

```cpp
struct VsyncConfig {
    nsecs_t sfOffset;                          // SF 相对 VSync 相位偏移
    nsecs_t appOffset;                         // App 相对 VSync 相位偏移
    chrono::nanoseconds sfWorkDuration;        // SF 工作时长
    chrono::nanoseconds appWorkDuration;       // App 工作时长
};

struct VsyncConfigSet {
    VsyncConfig early;      // 事务/刷新率切换
    VsyncConfig earlyGpu;   // GPU 合成
    VsyncConfig late;        // 默认
    nanoseconds hwcMinWorkDuration;
};
```

### WorkDuration 模式 — offset 计算公式

```
sfOffset  = vsyncDuration - sfDuration % vsyncDuration
appOffset = vsyncDuration - (appDuration + sfDuration) % vsyncDuration
```

### 典型值 (60Hz, period=16.67ms)

| Config | sfDuration | appDuration |
|--------|-----------|-------------|
| Late | ~15.6ms | ~16.6ms |
| Early | 较短 | 较短 |
| EarlyGpu | 较短 | ~16.6ms |

---

## 8. EventThread — App VSync 事件分发

**文件**: `EventThread.cpp:423`

```cpp
void onVsync(vsyncTime, wakeupTime, readyTime) {
    mPendingEvents.push_back(makeVSync(displayId, count, vsyncTime, readyTime));
    mCondition.notify_all();  // 唤醒工作线程
}

// 工作线程: 取出事件 → 筛选 consumer → 写入 BitTube (跨进程)
// App 端: Choreographer → DisplayEventReceiver 接收 → doFrame()
```

---

## 完整时序图

```
时间轴 (60Hz, period=16.67ms):

t=0          t=15.6ms      t=16.67ms     t=33.3ms
 │              │              │             │
[HW VSYNC]      │         [HW VSYNC]   [HW VSYNC]
 │              │              │             │
 ├─ VsyncSchedule.addResyncSample()
 ├─ VSyncReactor 验证
 ├─ VSyncPredictor 更新模型
 │              │              │
 │    VSyncDispatch 定时器触发:
 │      ├──────────────────────────────► SF 主线程
 │      │ (sfWorkDuration before VSync)  commit+composite
 │      │
 │      ├──────────────────────────────► EventThread(Render)
 │      │ (appWorkDuration+sfWorkDuration)  App 开始渲染
 │      │
 │      └──────────────────────────────► EventThread(LastComposite)
 │         (sfWorkDuration)
 │
 └─────────────────────────────────────────────────►
                   显示器呈现合成结果
```

---

## 调试

```bash
# 查看 VSync 配置和状态
dumpsys SurfaceFlinger | grep -A20 "VSync"

# 查看 event thread 状态
dumpsys SurfaceFlinger --vsync

# 开启详细 VSync 追踪
setprop debug.sf.vsp_trace 1
setprop debug.sf.vsync_trace_detailed_info 1

# systrace
atrace -t 5 -b 32768 gfx sched freq idle
```

---

**此 Skill 由 opencode 分析生成，可持续累积。**
