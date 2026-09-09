<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ id: string }>()

const storageKey = 'dsh-settings-open-' + props.id
const open = ref(true)
try {
  if (localStorage.getItem(storageKey) === '0') open.value = false
} catch {
  /* ignore */
}

function toggle(): void {
  open.value = !open.value
  try {
    localStorage.setItem(storageKey, open.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <el-card shadow="never" class="sec">
    <template #header>
      <div class="pc-head" @click="toggle">
        <slot name="header" />
        <span class="pc-caret" :class="{ off: !open }">▾</span>
      </div>
    </template>
    <div v-show="open" class="pc-body">
      <slot />
    </div>
  </el-card>
</template>

<style scoped>
.pc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.pc-head :deep(.sec__title) {
  flex: 1 1 auto;
}
.pc-caret {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  transition: transform 0.18s ease;
}
.pc-caret.off {
  transform: rotate(-90deg);
}
</style>
