package kr.aneum.pilot

import android.app.usage.UsageEvents.Event
import org.junit.Assert.*
import org.junit.Test

class UsageSummaryTest {
    @Test fun appSwitchesAreNotPhoneUses() {
        val s = UsageSummary(100, 1000)
        s.accept(Event.SCREEN_INTERACTIVE, 200)
        s.accept(Event.KEYGUARD_HIDDEN, 220)
        s.accept(Event.ACTIVITY_RESUMED, 250)
        s.accept(Event.ACTIVITY_RESUMED, 300)
        assertEquals(1, s.screenOnCount); assertEquals(1, s.unlockCount)
        assertEquals(200L, s.firstScreenOnAt); assertEquals(220L, s.firstUnlockAt)
    }
    @Test fun repeatedStateEventsDoNotInflateCounts() {
        val s = UsageSummary(100, 1000)
        s.accept(Event.SCREEN_INTERACTIVE, 200); s.accept(Event.SCREEN_INTERACTIVE, 210)
        s.accept(Event.KEYGUARD_HIDDEN, 220); s.accept(Event.KEYGUARD_HIDDEN, 230)
        s.accept(Event.SCREEN_NON_INTERACTIVE, 400); s.accept(Event.KEYGUARD_SHOWN, 410)
        s.accept(Event.SCREEN_INTERACTIVE, 500); s.accept(Event.KEYGUARD_HIDDEN, 520)
        assertEquals(2, s.screenOnCount); assertEquals(2, s.unlockCount)
        assertEquals(200L, s.firstScreenOnAt)
    }
    @Test fun screenWakeDoesNotImplyUnlockAndOutOfWindowIsIgnored() {
        val s = UsageSummary(100, 1000)
        s.accept(Event.KEYGUARD_HIDDEN, 99); s.accept(Event.SCREEN_INTERACTIVE, 200)
        s.accept(Event.KEYGUARD_HIDDEN, 1001)
        assertEquals(1, s.screenOnCount); assertEquals(0, s.unlockCount); assertNull(s.firstUnlockAt)
    }
}
