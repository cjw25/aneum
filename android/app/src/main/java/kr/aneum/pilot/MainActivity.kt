package kr.aneum.pilot

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.widget.*
import androidx.work.*
import java.net.URI
import java.util.concurrent.TimeUnit

class MainActivity : Activity() {
    private lateinit var status: TextView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("aneum", 0)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(38, 55, 38, 35) }
        fun text(value: String, size: Float = 16f) = TextView(this).apply { text = value; textSize = size; setPadding(0, 15, 0, 15); layout.addView(this) }
        fun button(value: String, action: () -> Unit) { layout.addView(Button(this).apply { text = value; setOnClickListener { action() } }) }
        text("안음", 34f)
        text("처음 한 번 연결하면, 일상은 그대로", 20f)
        text("이 시험 앱은 오늘 앱이 화면에 나타난 횟수를 서버에 보냅니다. 통화·문자 내용, 상대방, 앱 이름은 보내지 않습니다. 잠금 해제를 직접 세는 기능은 아닙니다. 전송이 늦거나 멈출 수 있으며 응급 감지 기능이 아닙니다.", 14f)
        val server = EditText(this).apply { hint = "서버 주소"; setText(prefs.getString("server", "http://127.0.0.1:8787")); inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI }; layout.addView(server)
        val token = EditText(this).apply { hint = "확인 화면에서 만든 휴대폰 연결 키"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }; layout.addView(token)
        val consent = CheckBox(this).apply { text = "위 활동 정보의 수집·전송에 동의합니다"; isChecked = prefs.getBoolean("consent", false) }; layout.addView(consent)
        button("1. 휴대폰 사용정보 접근 허용") { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
        button("2. 동의하고 자동 수집 시작") {
            try {
                val address = server.text.toString().trim().trimEnd('/')
                val uri = URI(address)
                require(uri.host != null && uri.userInfo == null && uri.rawQuery == null && uri.fragment == null && (uri.path.isNullOrEmpty() || uri.path == "/")) { "서버 주소 형식을 확인해주세요" }
                require(uri.scheme == "https" || (uri.scheme == "http" && uri.host in listOf("127.0.0.1", "localhost"))) { "HTTPS 주소가 필요합니다. 로컬 시험만 HTTP를 허용합니다." }
                require(consent.isChecked) { "수집·전송 동의가 필요합니다" }
                if (token.text.isNotBlank()) { require(token.text.toString().trim().matches(Regex("[a-f0-9]{64}"))) { "연결 키를 확인해주세요" }; Secrets.save(this, token.text.toString().trim()) }
                require(Secrets.read(this) != null) { "휴대폰 연결 키를 입력해주세요" }
                prefs.edit().putString("server", address).putBoolean("consent", true).commit()
                val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                val request = PeriodicWorkRequestBuilder<ReportWorker>(15, TimeUnit.MINUTES).setConstraints(constraints).build()
                WorkManager.getInstance(this).enqueueUniquePeriodicWork("aneum-periodic", ExistingPeriodicWorkPolicy.UPDATE, request)
                WorkManager.getInstance(this).enqueue(OneTimeWorkRequestBuilder<ReportWorker>().addTag("aneum-once").build())
                token.text.clear(); status.text = "자동 수집을 예약했어요. 전송 간격은 시스템에 따라 늦어질 수 있어요."
            } catch(e: Exception) { status.text = e.message ?: "설정을 확인해주세요" }
        }
        button("수집 상태 확인") { updateStatus() }
        button("동의 철회 · 수집 중지") {
            prefs.edit().clear().commit()
            WorkManager.getInstance(this).cancelUniqueWork("aneum-periodic")
            WorkManager.getInstance(this).cancelAllWorkByTag("aneum-once")
            consent.isChecked = false; token.text.clear(); status.text = "수집을 중지했어요. 서버 기록 삭제는 가족 확인 화면에서 연결 해제를 눌러주세요."
        }
        status = text("", 14f)
        setContentView(ScrollView(this).apply { addView(layout) })
    }
    override fun onResume() { super.onResume(); if (::status.isInitialized) updateStatus() }
    private fun updateStatus() {
        val prefs = getSharedPreferences("aneum", 0)
        status.text = "사용정보 권한: ${if (ReportWorker.allowed(this)) "허용" else "미허용"}\n자동 수집: ${if (prefs.getBoolean("consent", false)) "예약됨" else "중지"}\n${prefs.getString("result", "아직 전송 기록이 없어요")}" 
    }
}
