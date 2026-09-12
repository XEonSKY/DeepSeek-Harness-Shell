<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CompassOutlined, ReloadOutlined, ThunderboltOutlined } from '@antdv-next/icons'
import { ElMessageBox } from 'element-plus'
import { tt } from '../../lib/locales'
import { useSettingsStore } from './useSettingsStore'

/**
 * 「Webview」页：内嵌页面（dsh UI / 网页对话 / 所有动态标签）的渲染与身份设置。
 *
 * 两项设置的生效方式**不一样**，UI 上必须说清楚：
 *  - **硬件加速**只能在 `app ready` 之前决定（Electron 限制），所以改完必须重启；
 *    这里的交互照抄外观页「禁用系统缩放」：确认 → 落盘 → `relaunch()`。
 *  - **UserAgent** 落盘后主进程立刻 `session.defaultSession.setUserAgent()`，新请求即生效；
 *    已加载的页面要重新请求（刷新/重开标签）才带新 UA，所以也建议重启一次。
 */

const { state } = useSettingsStore()

const open = ref(['webview'])

/** 默认 UA 由主进程按当前平台 / Chromium 版本 / 程序版本生成（渲染层拿不到这些）。 */
const defaultUa = ref('')
const currentUa = ref('')

onMounted(async () => {
    try {
        const info = await window.api.getWebviewInfo()
        defaultUa.value = info.defaultUserAgent
        currentUa.value = info.currentUserAgent
    } catch {
    /* 拿不到就只显示输入框 */
    }
})

/** 硬件加速开关：与外观页的「禁用系统缩放」同一套流程（确认 → 保存 → 重启）。 */
async function onHwAccel(v: boolean): Promise<void> {
    if (v === state.hardwareAcceleration) return
    try {
        await ElMessageBox.confirm(tt('sv.webview.hwAccelText'), tt('sv.webview.hwAccel'), {
            confirmButtonText: tt('sv.webview.restartNow'),
            cancelButtonText: tt('msg.cancelBtn'),
            type: 'warning'
        })
    } catch {
        return // 取消：不动设置
    }
    state.hardwareAcceleration = v
    try {
        const cur = await window.api.getSettings()
        await window.api.saveSettings({ ...cur, hardwareAcceleration: v })
    } catch {
    /* 忽略：重启后仍会按内存里的设置走 */
    }
    window.api.relaunch()
}

/** 清空 = 回到默认 UA（实际字符串由主进程生成）。 */
function resetUa(): void {
    state.webviewUserAgent = ''
}
</script>

<template>
    <div class="panel">
        <div class="dsh-brand">
            <div class="dsh-brand__icon"><el-icon :size="34"><CompassOutlined /></el-icon></div>
            <div class="dsh-brand__txt">
                <div class="dsh-brand__name">{{ $t('sv.nav.webview') }}</div>
                <div class="dsh-brand__desc">{{ $t('sv.intro.webview') }}</div>
            </div>
        </div>

        <el-collapse v-model="open">
            <el-collapse-item name="webview">
                <template #title>
                    <div class="sec__title"><el-icon><ThunderboltOutlined /></el-icon> {{ $t('sv.webview.title') }}</div>
                </template>

                <!-- 硬件加速：只能在 ready 前决定，必须重启 -->
                <div class="wv-row">
                    <div class="wv-row__txt">
                        <div class="wv-row__t">{{ $t('sv.webview.hwAccel') }}</div>
                        <div class="wv-row__desc">{{ $t('sv.webview.hwAccelHint') }}</div>
                    </div>
                    <el-switch :model-value="state.hardwareAcceleration" @update:model-value="onHwAccel" />
                </div>

                <div class="upd-sep" />

                <!-- UserAgent：留空即默认；默认串由主进程按平台/版本生成 -->
                <el-form label-position="top">
                    <el-form-item :label="$t('sv.webview.ua')">
                        <el-input
                            v-model="state.webviewUserAgent"
                            type="textarea"
                            :rows="3"
                            :placeholder="defaultUa"
                            spellcheck="false"
                        />
                        <div class="ua-actions">
                            <el-button size="small" :icon="ReloadOutlined" :disabled="!state.webviewUserAgent" @click="resetUa">
                                {{ $t('sv.webview.uaReset') }}
                            </el-button>
                        </div>
                        <div class="hint">{{ $t('sv.webview.uaHint') }}</div>
                    </el-form-item>
                </el-form>

                <div class="ua-cur">
                    <div class="ua-cur__t">{{ $t('sv.webview.uaDefault') }}</div>
                    <code class="ua-cur__v">{{ defaultUa }}</code>
                    <div v-if="state.webviewUserAgent" class="ua-cur__t ua-cur__t--top">{{ $t('sv.webview.uaCurrent') }}</div>
                    <code v-if="state.webviewUserAgent" class="ua-cur__v">{{ currentUa }}</code>
                </div>
            </el-collapse-item>
        </el-collapse>
    </div>
</template>

<style scoped>
/* 只留本组件专用规则；跨组件通用样式一律进 styles/*.css（见 AGENT.md §3 样式约定）。 */
.wv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.wv-row__txt {
  flex: 1 1 auto;
  min-width: 260px;
}
.wv-row__t {
  font-weight: 600;
  margin-bottom: 4px;
}
.wv-row__desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
.ua-actions {
  margin-top: 8px;
}
/* UA 串很长：允许折行、等宽字体，别撑破面板 */
.ua-cur {
  margin-top: 6px;
}
.ua-cur__t {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
.ua-cur__t--top {
  margin-top: 12px;
}
.ua-cur__v {
  display: block;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  color: var(--el-text-color-regular);
}
</style>
