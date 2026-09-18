import SwiftUI

/// 앱이 보여 주는 것 전부: 웹뷰 한 장, 그리고 그게 안 열렸을 때의 화면.
struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var state = WebState()

    var body: some View {
        ZStack {
            // 웹앱이 뜨기 전에도 바탕은 종이색이어야 한다. 기본 흰색이면 첫 순간에 번쩍인다.
            Color(red: 0.961, green: 0.965, blue: 0.973).ignoresSafeArea()

            SiteWebView(state: state)
                // 웹앱이 자기 아래 여백을 직접 관리한다. 여기서 또 넣으면 두 번 들어간다.
                .ignoresSafeArea(.container, edges: .bottom)
                .opacity(state.failed ? 0 : 1)

            if state.failed {
                OfflineView(retry: { state.reload() })
            }
        }
        /*
          **앞으로 나올 때 다시 읽는다.**

          점수 앱이라서 그렇다. 어제 보다 만 화면이 그대로 떠 있으면, 그 화면은 틀린 게
          아니라 **어제 것인데 오늘 것처럼 보인다.** 다만 앱을 방금 내렸다 올린 경우까지
          다시 읽으면 깜빡임만 는다 — 그래서 마지막으로 읽은 지 1분이 지났을 때만.
        */
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            state.reloadIfStale()
        }
    }
}

/// 못 열었을 때. **빈 화면을 주지 않는다** — 빈 화면은 앱이 고장 난 것으로 읽힌다.
private struct OfflineView: View {
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Text("Can't reach SL Sports")
                .font(.system(size: 17, weight: .semibold))
            Text("Check your connection and try again.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
            Button("Try again", action: retry)
                .font(.system(size: 15, weight: .medium))
                .padding(.horizontal, 18)
                .padding(.vertical, 9)
                .background(Color(white: 0.93), in: .rect(cornerRadius: 4))
                .foregroundStyle(.primary)
                .padding(.top, 4)
        }
        .padding(32)
    }
}
