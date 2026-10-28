package kr.aneum.pilot

import android.app.usage.UsageEvents

class UsageSummary(private val start: Long, private val end: Long) {
    var firstScreenOnAt: Long? = null; private set
    var firstUnlockAt: Long? = null; private set
    var screenOnCount = 0; private set
    var unlockCount = 0; private set
    private var interactive: Boolean? = null
    private var locked: Boolean? = null
    fun accept(type: Int, at: Long) {
        if (at < start || at > end) return
        when (type) {
            UsageEvents.Event.SCREEN_INTERACTIVE -> {
                if (interactive != true) { screenOnCount++; if (firstScreenOnAt == null) firstScreenOnAt = at }
                interactive = true
            }
            UsageEvents.Event.SCREEN_NON_INTERACTIVE -> { interactive = false }
            UsageEvents.Event.KEYGUARD_HIDDEN -> {
                if (locked != false) { unlockCount++; if (firstUnlockAt == null) firstUnlockAt = at }
                locked = false
            }
            UsageEvents.Event.KEYGUARD_SHOWN -> { locked = true }
        }
    }
}
