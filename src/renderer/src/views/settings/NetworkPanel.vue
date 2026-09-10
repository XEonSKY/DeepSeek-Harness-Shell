<script setup lang="ts">
import { ref } from 'vue'
import { ApiOutlined, LinkOutlined, DownloadOutlined } from '@antdv-next/icons'
import { useSettingsStore } from './useSettingsStore'
import type { ProxyScope } from '@shared/types'

const { state } = useSettingsStore()

const open = ref(['network-registry', 'network-proxy', 'network-mirror'])
const SCOPES: ProxyScope[] = ['npm', 'node', 'update']

function toggleScope(s: ProxyScope): void {
  const i = state.proxyScope.indexOf(s)
  if (i >= 0) state.proxyScope.splice(i, 1)
  else state.proxyScope.push(s)
}
</script>

<template>
  <div class="panel">
    <div class="dsh-brand">
      <div class="dsh-brand__icon"><el-icon :size="34"><ApiOutlined /></el-icon></div>
      <div class="dsh-brand__txt">
        <div class="dsh-brand__name">{{ $t('sv.nav.network') }}</div>
        <div class="dsh-brand__desc">{{ $t('sv.intro.network') }}</div>
      </div>
    </div>
    <el-collapse v-model="open">
      <el-collapse-item name="network-registry">
        <template #title>
          <div class="sec__title"><el-icon><ApiOutlined /></el-icon> {{ $t('sv.network.registry') }}</div>
        </template>
        <el-form label-position="top">
          <el-form-item :label="$t('sv.network.registry')">
            <el-select v-model="state.npmRegistry" class="reg">
              <el-option :label="$t('sv.dsh.registryNpmjs')" value="npmjs" />
              <el-option :label="$t('sv.dsh.registryNpmmirror')" value="npmmirror" />
            </el-select>
            <div class="hint">{{ $t('sv.network.registryHint') }}</div>
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item name="network-proxy">
        <template #title>
          <div class="sec__title"><el-icon><LinkOutlined /></el-icon> {{ $t('sv.network.proxy') }}</div>
        </template>
        <el-form label-position="top">
          <el-form-item>
            <el-switch v-model="state.proxyEnabled" inline-prompt :active-text="$t('sv.network.enable')" />
          </el-form-item>

          <template v-if="state.proxyEnabled">
            <el-form-item :label="$t('sv.network.protocol')">
              <el-radio-group v-model="state.proxyProtocol">
                <el-radio-button :value="'http'">{{ $t('sv.network.protocolHttp') }}</el-radio-button>
                <el-radio-button :value="'socks5'">{{ $t('sv.network.protocolSocks') }}</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <div class="row">
              <el-form-item :label="$t('sv.network.host')" class="grow">
                <el-input v-model="state.proxyHost" placeholder="127.0.0.1" />
              </el-form-item>
              <el-form-item :label="$t('sv.network.port')" class="port">
                <el-input-number v-model="state.proxyPort" :min="1" :max="65535" :controls="false" placeholder="8080" />
              </el-form-item>
            </div>

            <el-form-item :label="$t('sv.network.scope')">
              <div class="scope">
                <el-checkbox
                  v-for="s in SCOPES"
                  :key="s"
                  :model-value="state.proxyScope.includes(s)"
                  @update:model-value="() => toggleScope(s)"
                >
                  {{ $t('sv.network.scope' + (s === 'npm' ? 'Npm' : s === 'node' ? 'Node' : 'Update')) }}
                </el-checkbox>
              </div>
              <div class="hint">{{ $t('sv.network.scopeHint') }}</div>
            </el-form-item>
          </template>
        </el-form>
      </el-collapse-item>

      <el-collapse-item name="network-mirror">
        <template #title>
          <div class="sec__title"><el-icon><DownloadOutlined /></el-icon> {{ $t('sv.network.mirror') }}</div>
        </template>
        <el-form label-position="top">
          <el-form-item :label="$t('sv.network.mirrorUrl')">
            <el-input v-model="state.updateMirrorUrl" placeholder="https://ghproxy.com" clearable />
            <div class="hint">{{ $t('sv.network.mirrorHint') }}</div>
            <div class="hint">{{ $t('sv.network.mirrorBroken') }}</div>
          </el-form-item>
        </el-form>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.reg {
  width: 100%;
}
.row {
  display: flex;
  gap: 12px;
  width: 100%;
}
.grow {
  flex: 1 1 auto;
}
.port {
  width: 170px;
}
.scope {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
