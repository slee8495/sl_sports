# SL Sports — 아이폰 앱

화면은 웹앱이 전부 갖고 있다. 이 앱은 **껍데기**다 — `https://slsports.vercel.app` 을
`WKWebView` 로 띄우고, 홈 화면에서 다른 앱과 같은 줄에 서게 하는 것이 전부다.

네이티브 쪽이 하는 일은 넷뿐이다.

| 하는 일 | 왜 |
| --- | --- |
| 아래로 당겨 새로고침 | 점수 화면에서 제일 먼저 하는 손버릇. 없으면 앱을 껐다 켜는 수밖에 없다 |
| 앞으로 나올 때 1분 지났으면 다시 읽기 | 어제 보던 화면이 그대로 떠 있으면 **어제 것인데 오늘 것처럼 보인다** |
| 바깥 링크는 사파리로 | 뉴스·티켓·중계 링크를 웹뷰에서 열면 주소창도 뒤로 가기도 없는 곳에 갇힌다 |
| 마이크 허용 | 챗의 음성 입력. 웹뷰는 기본이 거절이라 막아 두면 그냥 안 된다 |

센서도, 푸시도, 웹↔네이티브 다리도 없다. 필요해지면 그때 더한다.

## 빌드

```bash
cd ios && xcodegen generate     # 파일을 새로 추가했으면 반드시 먼저
open SLSports.xcodeproj
```

`.xcodeproj` 는 `project.yml` 에서 만들어지므로 커밋하지 않는다.

## 시뮬레이터로 확인

```bash
B=/tmp/slsports-sim
xcodebuild -project SLSports.xcodeproj -scheme SLSports -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath "$B/dd" CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot "iPhone 17 Pro"
xcrun simctl install booted "$B/dd/Build/Products/Debug-iphonesimulator/SLSports.app"
xcrun simctl launch booted com.slstudio.slsports
```

## 테스트플라이트에 올리기

```bash
B=/tmp/slsports-ios          # iCloud 밖이어야 한다(아래 참고)
cd ios && xcodegen generate
xcodebuild -project SLSports.xcodeproj -scheme SLSports -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$B/SLSports.xcarchive" \
  -derivedDataPath "$B/dd" -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath "$B/SLSports.xcarchive" \
  -exportOptionsPlist "$B/ExportOptions.plist" -exportPath "$B/export" -allowProvisioningUpdates
xcrun altool --upload-app -f "$B/export/SLSports.ipa" -t ios \
  --apiKey 7U49JQRU3Q --apiIssuer "$(cat ~/.appstoreconnect/issuer_id)"
```

- **`$B` 는 iCloud 밖에 둔다.** iCloud 가 xattr 를 붙이면 코드사인이 "resource fork,
  Finder information, or similar detritus" 로 죽는다(브라우니에서 겪은 것).
- `ExportOptions.plist` 는 `method: app-store-connect`, `teamID: DX4YLNP9RK`.
- 키와 issuer 는 `~/.appstoreconnect/` 에 있다(레포 밖, chmod 600).
- **올릴 때마다 `project.yml` 의 `CURRENT_PROJECT_VERSION` 을 올린다.** 안 올리면 거절된다.
- 앱 레코드는 **API 로 못 만든다.** 애플이 막아 뒀다 — App Store Connect 웹에서 한 번
  만들어야 하고(번들 ID `com.slstudio.slsports`), 그 전에는 업로드가
  "Cannot determine the Apple ID from Bundle ID" 로 끝난다.
