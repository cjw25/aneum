package kr.aneum.pilot

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
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
            var count = 0
            var measurementError = false
            if (permission) {
                try {
                    val manager = applicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                    // Foreground transitions, not calls, texts, or confirmed unlocks.
                    val events = manager.queryEvents(start, now)
                    if (events == null) measurementError = true
                    else {
                        val event = UsageEvents.Event()
                        while (events.hasNextEvent()) {
                            events.getNextEvent(event)
                            @Suppress("DEPRECATION")
                            if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND && event.packageName != applicationContext.packageName) count++
                        }
                    }
                } catch (_: Exception) { measurementError = true; count = 0 }
            }
            val payload = JSONObject().put("windowStart", start).put("windowEnd", now)
                .put("activityCount", count).put("permissionGranted", permission).put("measurementError", measurementError)
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
