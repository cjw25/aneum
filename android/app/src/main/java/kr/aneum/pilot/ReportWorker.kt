package kr.aneum.pilot

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import android.Manifest
import android.content.pm.PackageManager
import android.provider.CallLog
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.TimeZone

class ReportWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        fun allowed(context: Context): Boolean {
            val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            @Suppress("DEPRECATION")
            return ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
        }
    }
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = applicationContext.getSharedPreferences("aneum", 0)
        if (!prefs.getBoolean("consent", false)) return@withContext Result.success()
        try {
            val token = Secrets.read(applicationContext) ?: return@withContext Result.failure()
            val endpoint = prefs.getString("server", "") ?: ""
            val now = System.currentTimeMillis()
            val start = Calendar.getInstance(TimeZone.getTimeZone("Asia/Seoul")).apply {
                timeInMillis = now; set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            }.timeInMillis
            val permission = allowed(applicationContext)
            var summary: UsageSummary? = null
            var measurementError = false
            if (permission) {
                try {
                    val manager = applicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                    // Screen-interactive and keyguard transitions are separate measures.
                    val events = manager.queryEvents(start, now)
                    if (events == null) measurementError = true
                    else {
                        val collected = UsageSummary(start, now)
                        val event = UsageEvents.Event()
                        while (events.hasNextEvent()) {
                            events.getNextEvent(event)
                            collected.accept(event.eventType, event.timeStamp)
                        }
                        summary = collected
                    }
                } catch (_: Exception) { measurementError = true; summary = null }
            }
            var callStatus = if (BuildConfig.ENABLE_CALL_LOG) "permission_denied" else "not_enabled"
            var incoming: Int? = null; var outgoing: Int? = null; var missed: Int? = null
            if (BuildConfig.ENABLE_CALL_LOG && applicationContext.checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED) {
                try {
                    applicationContext.contentResolver.query(CallLog.Calls.CONTENT_URI, arrayOf(CallLog.Calls.TYPE),
                        "${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.DATE} <= ?", arrayOf(start.toString(), now.toString()), null).use { cursor ->
                        if (cursor == null) { callStatus = "error" }
                        else {
                            var inc = 0; var out = 0; var miss = 0
                            while (cursor.moveToNext()) when (cursor.getInt(0)) {
                                CallLog.Calls.INCOMING_TYPE -> inc++
                                CallLog.Calls.OUTGOING_TYPE -> out++
                                CallLog.Calls.MISSED_TYPE -> miss++
                            }
                            incoming = inc; outgoing = out; missed = miss; callStatus = "available"
                        }
                    }
                } catch (_: Exception) { callStatus = "error"; incoming = null; outgoing = null; missed = null }
            }
            fun value(v: Any?): Any = v ?: JSONObject.NULL
            val payload = JSONObject().put("windowStart", start).put("windowEnd", now)
                .put("schemaVersion", 2).put("activityCount", summary?.screenOnCount ?: 0).put("permissionGranted", permission).put("measurementError", measurementError)
                .put("usageStatus", if (!permission) "permission_denied" else if (measurementError) "error" else "available")
                .put("firstScreenOnAt", value(summary?.firstScreenOnAt)).put("firstUnlockAt", value(summary?.firstUnlockAt))
                .put("screenOnCount", value(summary?.screenOnCount)).put("unlockCount", value(summary?.unlockCount))
                .put("callStatus", callStatus).put("incomingCallCount", value(incoming)).put("outgoingCallCount", value(outgoing)).put("missedCallCount", value(missed))
            if (!prefs.getBoolean("consent", false)) return@withContext Result.success()
            val connection = URL("$endpoint/api/report").openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "POST"; connection.connectTimeout = 15000; connection.readTimeout = 15000
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                if (status in 200..299) {
                    prefs.edit().putString("result", "전송 완료 · ${java.text.DateFormat.getDateTimeInstance().format(java.util.Date())}").apply()
                    Result.success()
                } else {
                    prefs.edit().putString("result", "전송 실패 · HTTP $status").apply()
                    if (status >= 500) Result.retry() else Result.failure()
                }
            } finally { connection.disconnect() }
        } catch (_: Exception) {
            prefs.edit().putString("result", "전송 대기 · 서버 연결을 확인해주세요").apply()
            Result.retry()
        }
    }
}
