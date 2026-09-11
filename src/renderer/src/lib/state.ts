import { reactive } from 'vue'

/** Shared UI state about the underlying dsh server and current workspace. */
export const appState = reactive<{
    url: string | null
    connected: boolean
    starting: boolean
    workspace: string | null
}>({
    url: null,
    connected: false,
    starting: true,
    workspace: null
})
