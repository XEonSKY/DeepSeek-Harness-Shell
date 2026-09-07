<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import type { LogEntry } from '@shared/types'

const box = ref<HTMLDivElement | null>(null)
const count = ref(0)
const autoScroll = ref(true)
let offLog: (() => void) | null = null
const MAX = 6000

function pushOne(k: LogEntry['k'], s: string): void {
  const text = String(s ?? '')
  const parts = text.split('\n')
  if (parts[parts.length - 1] === '') parts.pop()
  for (const ln of parts) {
    const el = document.createElement('div')
    el.className = 'line ' + (k === 'e' ? 'err' : 'out')
    el.textContent = ln
    box.value?.appendChild(el)
    count.value++
  }
  while (box.value && box.value.childElementCount > MAX) {
    box.value.removeChild(box.value.firstElementChild as Node)
  }
  if (autoScroll.value && box.value) box.value.scrollTop = box.value.scrollHeight
}

function clear(): void {
  if (box.value) box.value.textContent = ''
  count.value = 0
}

onMounted(async () => {
  const history = await window.api.getLogHistory()
  for (const entry of history) pushOne(entry.k, entry.s)
  offLog = window.api.onLog((entry) => pushOne(entry.k, entry.s))
})

onBeforeUnmount(() => offLog?.())
</script>

<template>
  <div class="log">
    <div class="log__bar">
      <span class="title">{{ $t('log.title') }}</span>
      <span class="meta">{{ $t('log.lineCount', { count }) }}</span>
      <div class="spacer" />
      <el-checkbox v-model="autoScroll">{{ $t('log.autoScroll') }}</el-checkbox>
      <el-button size="small" text type="danger" @click="clear">
        <el-icon><Delete /></el-icon>
        <span>{{ $t('log.clear') }}</span>
      </el-button>
    </div>
    <div ref="box" class="log__box"></div>
    <div v-if="count === 0" class="placeholder">
      {{ $t('log.empty') }}
    </div>
  </div>
</template>

<style scoped>
.log {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}
.log__bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--el-border-color-light);
  font-size: 13px;
}
.title {
  font-weight: 600;
}
.meta {
  color: var(--el-text-color-secondary);
}
.spacer {
  flex: 1 1 auto;
}
.log__box {
  flex: 1 1 auto;
  overflow: auto;
  padding: 8px 14px;
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  line-height: 1.45;
}
.log__box .line {
  white-space: pre-wrap;
  word-break: break-all;
}
.log__box .line.out {
  color: var(--el-text-color-primary);
}
.log__box .line.err {
  color: var(--el-color-danger);
}
.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
}
</style>
