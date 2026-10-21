<script setup lang="ts">
import browser from 'webextension-polyfill'

import Button from '~/components/Button.vue'
import Radio from '~/components/Radio.vue'
import SettingsItem from '~/components/Settings/components/SettingsItem.vue'
import SettingsItemGroup from '~/components/Settings/components/SettingsItemGroup.vue'
import { settings } from '~/logic'

import type { SafariUpdateState } from './shared'
import { formatCopy, getSafariUpdateCopy, readPrefs, SAFARI_RELEASES_URL, UPDATE_CHECK_NOW_MESSAGE, UPDATE_GET_STATE_MESSAGE, updatePrefs } from './shared'

const isSafariBuild = __SAFARI__
const enabled = ref(true)
const checking = ref(false)
const state = ref<SafariUpdateState>()
const currentVersion = browser.runtime.getManifest().version

const copy = computed(() => getSafariUpdateCopy(settings.value.language || browser.i18n.getUILanguage()))

const status = computed(() => {
  if (checking.value)
    return copy.value.checking
  if (!state.value)
    return ''
  if (state.value.failed)
    return copy.value.failed
  if (state.value.hasUpdate && state.value.latest)
    return formatCopy(copy.value.available, state.value.latest.version)
  return state.value.checkedAt ? copy.value.upToDate : ''
})

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener')
}

async function handleToggle(value: boolean) {
  enabled.value = value
  await updatePrefs({ enabled: value })
}

async function checkNow() {
  if (checking.value)
    return
  checking.value = true
  try {
    state.value = await browser.runtime.sendMessage({ type: UPDATE_CHECK_NOW_MESSAGE }) as SafariUpdateState
  }
  catch {
    state.value = { enabled: enabled.value, currentVersion, hasUpdate: false, shouldNotify: false, failed: true }
  }
  finally {
    checking.value = false
  }
}

onMounted(async () => {
  if (!isSafariBuild)
    return
  enabled.value = (await readPrefs()).enabled
  try {
    state.value = await browser.runtime.sendMessage({ type: UPDATE_GET_STATE_MESSAGE }) as SafariUpdateState
  }
  catch {}
})
</script>

<template>
  <SettingsItemGroup v-if="isSafariBuild" title="BewlyCat Safari">
    <SettingsItem
      :title="copy.settingTitle"
      :desc="copy.settingDesc"
      right-width="auto"
    >
      <Radio :model-value="enabled" @update:model-value="handleToggle" />
    </SettingsItem>
    <SettingsItem
      :title="formatCopy(copy.currentVersion, currentVersion)"
      :desc="status"
      right-width="auto"
    >
      <div flex="~ gap-2">
        <Button
          v-if="state?.hasUpdate && state.latest"
          type="primary"
          size="small"
          @click="openUrl(state.latest.url)"
        >
          {{ copy.view }}
        </Button>
        <Button
          v-else
          type="secondary"
          size="small"
          @click="openUrl(SAFARI_RELEASES_URL)"
        >
          GitHub Releases
        </Button>
        <Button
          type="secondary"
          size="small"
          :disabled="checking"
          @click="checkNow"
        >
          {{ copy.checkNow }}
        </Button>
      </div>
    </SettingsItem>
  </SettingsItemGroup>
</template>
