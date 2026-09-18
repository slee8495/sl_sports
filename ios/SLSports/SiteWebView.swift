import SwiftUI
import SafariServices
import WebKit

private let siteURL = URL(string: "https://slsports.vercel.app")!

/// 웹뷰가 지금 어떤 상태인지, 그리고 바깥에서 그걸 건드리는 통로.
@MainActor
final class WebState: ObservableObject {
    /// 한 번도 못 열었다. 화면이 대신 말해 준다.
    @Published var failed = false

    weak var webView: WKWebView?
    private var lastLoaded = Date.distantPast

    func markLoaded() {
        lastLoaded = Date()
        failed = false
    }

    func reload() {
        failed = false
        webView?.load(URLRequest(url: siteURL))
    }

    /// 마지막으로 읽은 지 1분이 지났으면 다시 읽는다.
    func reloadIfStale() {
        guard Date().timeIntervalSince(lastLoaded) > 60 else { return }
        reload()
    }
}

struct SiteWebView: UIViewRepresentable {
    @ObservedObject var state: WebState

    func makeCoordinator() -> Coordinator { Coordinator(state: state) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        /*
          챗이 답을 소리로 읽어 준다. 기본값은 소리 재생에 사용자 탭을 요구하는데, 읽어
          주는 건 사용자가 누른 결과가 아니라 답이 끝난 결과라 그대로 두면 소리가 안 난다.
        */
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        /*
          웹이 **어떤 껍데기 안에서 도는지** 알게 한다. 기본 UA 를 갈아치우지 않고 뒤에
          붙는 자리라, 서버 로그에도 같이 남는다 — "앱에서 열었을 때만 이상하다" 를
          나중에 가려낼 수 있는 유일한 표식이다.
        */
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        config.applicationNameForUserAgent = "SLSports/\(build)"

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        // 설치된 앱처럼 굴게 한다. 끝에서 튕기면 사파리 티가 난다.
        webView.scrollView.bounces = false

        /*
          **아래로 당겨 새로고침.** 점수 화면에서 제일 먼저 하는 손버릇이고, 이게 없으면
          최신인지 확인할 방법이 앱을 껐다 켜는 것뿐이다. 당기기는 튕김이 있어야 되므로
          이 스크롤뷰만 예외로 둔다.
        */
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.pulled(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        state.webView = webView
        webView.load(URLRequest(url: siteURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let state: WebState

        init(state: WebState) { self.state = state }

        @objc func pulled(_ sender: UIRefreshControl) {
            state.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            Task { @MainActor in state.markLoaded() }
        }

        private func failed(_ webView: WKWebView) {
            webView.scrollView.refreshControl?.endRefreshing()
            Task { @MainActor in
                // 이미 무언가 떠 있으면 실패 화면으로 덮지 않는다 — 보던 것을 뺏는 셈이 된다.
                if webView.url == nil { state.failed = true }
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            failed(webView)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            failed(webView)
        }

        /*
          **바깥 링크는 사파리로 보낸다.**

          이 앱 안에는 뉴스 기사, 티켓, 중계 링크가 널려 있다. 그걸 이 웹뷰에서 열면
          ESPN 한복판에 갇히는데, 여기에는 주소창도 뒤로 가기 버튼도 없다(쓸어서 뒤로는
          되지만 그걸 아는 사람만 나올 수 있다). 우리 주소만 안에서 연다.
        */
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            let ours = url.host == siteURL.host
            let isLink = navigationAction.navigationType == .linkActivated
            if isLink && !ours {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        /// `target="_blank"` 로 여는 링크. 웹뷰는 기본적으로 아무 데도 안 여니 우리가 연다.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url { UIApplication.shared.open(url) }
            return nil
        }

        /*
          마이크. iOS 가 이미 앱 단위로 한 번 물었으므로 여기서 또 막을 이유가 없다 —
          기본값은 거절이고, 그러면 두 번 묻는 게 아니라 그냥 안 된다.
        */
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            decisionHandler(origin.host == siteURL.host ? .grant : .deny)
        }
    }
}
