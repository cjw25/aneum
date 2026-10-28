import SwiftUI
import BackgroundTasks
import Security

enum ConnectionKey {
    static let service = "kr.aneum.pilot.connection"
    static var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "device"] }
    static func read() -> String? {
        var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func save(_ value: String) throws {
        let data = Data(value.utf8)
        let update = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if update == errSecSuccess { return }
        guard update == errSecItemNotFound else { throw PilotError.message("연결 키 저장 실패") }
        var q = query; q[kSecValueData as String] = data; q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else { throw PilotError.message("연결 키 저장 실패") }
    }
    static func clear() { SecItemDelete(query as CFDictionary) }
}

enum PilotError: LocalizedError {
    case message(String)
    var errorDescription: String? { switch self { case .message(let message): return message } }
}

@MainActor final class Monitor: ObservableObject {
    static let shared = Monitor()
    @Published var status = "아직 전송 기록이 없어요."
    @Published var busy = false
    private var generation = 0
    static let taskID = "kr.aneum.pilot.refresh"
    func schedule() {
        guard UserDefaults.standard.bool(forKey: "consent") else { return }
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskID)
        let request = BGAppRefreshTaskRequest(identifier: Self.taskID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        do { try BGTaskScheduler.shared.submit(request) }
        catch { status = "백그라운드 예약 불가: \(error.localizedDescription)" }
    }
    func stop() {
        generation += 1
        UserDefaults.standard.removeObject(forKey: "consent")
        UserDefaults.standard.removeObject(forKey: "server")
        ConnectionKey.clear()
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskID)
        status = "수집을 중지했어요. 서버 기록은 가족 확인 화면에서 연결 해제로 삭제해주세요."
    }
    func report() async -> Bool {
        guard !busy, UserDefaults.standard.bool(forKey: "consent"), let token = ConnectionKey.read(), let endpoint = UserDefaults.standard.string(forKey: "server"), let url = URL(string: endpoint + "/api/report") else { return false }
        busy = true
        defer { busy = false }
        let currentGeneration = generation
        let end = Date()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
        let start = calendar.startOfDay(for: end)
        guard !Task.isCancelled, currentGeneration == generation, UserDefaults.standard.bool(forKey: "consent") else { return false }
        let payload: [String: Any] = [
            "schemaVersion": 2, "windowStart": Int64(start.timeIntervalSince1970 * 1000),
            "windowEnd": Int64(end.timeIntervalSince1970 * 1000), "activityCount": 0,
            "permissionGranted": true, "measurementError": false,
            "usageStatus": "unsupported", "callStatus": "unsupported",
            "firstScreenOnAt": NSNull(), "firstUnlockAt": NSNull(),
            "screenOnCount": NSNull(), "unlockCount": NSNull(),
            "incomingCallCount": NSNull(), "outgoingCallCount": NSNull(), "missedCallCount": NSNull()
        ]
        do {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"; request.timeoutInterval = 20
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let response = response as? HTTPURLResponse, (200...299).contains(response.statusCode) else { throw PilotError.message("서버 전송 실패. 연결 키와 서버를 확인해주세요.") }
            guard currentGeneration == generation else { return false }
            status = "전송 완료 · \(Date().formatted(date: .abbreviated, time: .shortened))"
            return true
        } catch {
            if currentGeneration == generation { status = "전송 대기 · \(error.localizedDescription)" }
            return false
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: "kr.aneum.pilot.refresh", using: nil) { task in
            let work = Task { @MainActor in
                Monitor.shared.schedule()
                let success = await Monitor.shared.report()
                task.setTaskCompleted(success: success)
            }
            task.expirationHandler = { work.cancel() }
        }
        return true
    }
}

@main struct AneumApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup { ContentView() }
            .onChange(of: phase) { value in
                if value == .background { Task { @MainActor in Monitor.shared.schedule() } }
            }
    }
}

struct ContentView: View {
    @StateObject private var monitor = Monitor.shared
    @State private var server = UserDefaults.standard.string(forKey: "server") ?? "https://aneum.vercel.app"
    @State private var key = ""
    @State private var consent = UserDefaults.standard.bool(forKey: "consent")
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("처음 한 번 연결하면, 일상은 그대로").font(.title2).bold()
                    Text("이 아이폰 버전은 첫 화면 사용 시각·하루 사용 횟수·통화 횟수를 자동 수집하지 못합니다. 연결 상태와 지원 여부만 전송합니다.")
                    Text("걸음 수를 휴대폰 사용 기록으로 대신 표시하지 않습니다. 아이폰 지원 검증은 별도로 필요합니다.").font(.footnote).foregroundStyle(.secondary)
                }
                Section("가족 연결") {
                    TextField("서버 주소", text: $server).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                    SecureField("휴대폰 연결 키", text: $key)
                    Toggle("활동 정보 수집·전송에 동의합니다", isOn: $consent)
                    Button("동의하고 자동 수집 시작") {
                        Task { @MainActor in
                            do {
                                guard consent else { throw PilotError.message("수집·전송 동의가 필요합니다") }
                                let address = server.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
                                guard let url = URL(string: address), let host = url.host, url.user == nil, url.password == nil, url.query == nil, url.fragment == nil, url.path.isEmpty, url.scheme == "https" || (url.scheme == "http" && ["localhost", "127.0.0.1"].contains(host)) else { throw PilotError.message("HTTPS 서버 주소를 입력해주세요. 로컬 시험만 HTTP를 허용합니다.") }
                                let value = key.trimmingCharacters(in: .whitespacesAndNewlines)
                                if !value.isEmpty {
                                    guard value.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw PilotError.message("연결 키를 확인해주세요") }
                                    try ConnectionKey.save(value)
                                }
                                guard ConnectionKey.read() != nil else { throw PilotError.message("휴대폰 연결 키를 입력해주세요") }
                                UserDefaults.standard.set(address, forKey: "server")
                                UserDefaults.standard.set(true, forKey: "consent")
                                key = ""
                                _ = await monitor.report()
                                monitor.schedule()
                            } catch { monitor.status = error.localizedDescription }
                        }
                    }.disabled(monitor.busy)
                }
                Section("수집 상태") {
                    Text(monitor.status)
                    Text("15분 이후 실행을 요청하지만 실제 실행 시점은 iOS가 결정합니다. 앱 강제 종료·저전력 모드·백그라운드 새로고침 설정 등에 따라 갱신이 중단될 수 있습니다.").font(.footnote).foregroundStyle(.secondary)
                    Button("시험용으로 지금 전송") { Task { _ = await monitor.report() } }.disabled(monitor.busy)
                    Button("동의 철회 · 수집 중지", role: .destructive) { monitor.stop(); consent = false; key = "" }
                }
            }.navigationTitle("안음 · 시험 앱")
        }.tint(Color(red: 0.2, green: 0.36, blue: 0.28))
    }
}
