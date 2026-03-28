# 배구 전문 비디오 판독 시스템 - WebRTC 시그널링 서버 설정

## 🎯 개요

이 시스템은 WebRTC를 사용하여 핸드폰 카메라와 컴퓨터를 무선으로 연결합니다.
핸드폰에서 촬영한 배구 경기 영상을 실시간으로 컴퓨터로 전송하여 분석할 수 있습니다.

## 🔧 시그널링 서버 설정

### 1. Node.js 설치 확인
```bash
node --version
npm --version
```

### 2. WebSocket 라이브러리 설치
```bash
npm install ws
```

### 3. 시그널링 서버 실행
```bash
node signaling-server.js
```

서버가 성공적으로 실행되면:
```
Signaling server running on ws://localhost:3000
Press Ctrl+C to stop
```

## 📱 사용 방법

### 핸드폰 (송신자)
1. 웹 앱에서 "핸드폰 카메라" 모드 선택
2. "카메라 시작" 버튼 클릭
3. 카메라 권한 허용
4. 생성된 연결 코드(Room ID) 확인 (예: ABC123)
5. 컴퓨터가 연결될 때까지 대기

### 컴퓨터 (수신자)
1. 웹 앱에서 "컴퓨터 수신" 모드 선택
2. 핸드폰에 표시된 연결 코드 입력
3. "연결하기" 버튼 클릭
4. 핸드폰 카메라 영상이 실시간으로 표시됨
5. "녹화 시작" 버튼으로 경기 녹화

## 🌐 네트워크 요구사항

### 로컬 테스트 (같은 컴퓨터)
- 시그널링 서버: `ws://localhost:3000`
- 핸드폰과 컴퓨터가 같은 브라우저 탭 또는 다른 탭에서 실행

### 로컬 네트워크 (같은 Wi-Fi)
1. 시그널링 서버를 실행하는 컴퓨터의 로컬 IP 확인
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

2. 코드에서 SIGNALING_URL 변경
   ```typescript
   // PhoneCamera.tsx와 ComputerReceiver.tsx
   const SIGNALING_URL = "ws://192.168.1.100:3000";  // 실제 IP로 변경
   ```

### 인터넷 연결 (다른 네트워크)
1. 공개 서버에 시그널링 서버 배포 필요
2. HTTPS/WSS 사용 권장
3. TURN 서버 추가 권장:
   ```typescript
   const STUN_CONFIG: RTCConfiguration = {
     iceServers: [
       { urls: "stun:stun.l.google.com:19302" },
       {
         urls: "turn:your-turn-server.com:3478",
         username: "username",
         credential: "password"
       }
     ],
   };
   ```

## 🔍 트러블슈팅

### 연결되지 않을 때
1. ✅ 시그널링 서버가 실행 중인지 확인
2. ✅ 방화벽이 포트 3000을 차단하지 않는지 확인
3. ✅ 브라우저 콘솔에서 에러 메시지 확인
4. ✅ 양쪽 모두 같은 연결 코드(Room ID)를 사용하는지 확인

### 카메라 권한 문제
1. 브라우저 주소창의 자물쇠 🔒 아이콘 클릭
2. "권한" 또는 "사이트 설정" 선택
3. 카메라 권한을 "허용"으로 변경
4. 페이지 새로고침

### 영상이 끊길 때
1. 네트워크 연결 상태 확인
2. TURN 서버 추가 고려 (NAT 통과)
3. 비디오 해상도 낮추기:
   ```typescript
   video: {
     facingMode: { ideal: 'environment' },
     width: { ideal: 1280 },   // 1920에서 낮춤
     height: { ideal: 720 }     // 1080에서 낮춤
   }
   ```

## 📊 시스템 구조

```
[핸드폰 카메라] --WebRTC--> [시그널링 서버] <--WebRTC-- [컴퓨터 수신]
      ↓                           ↓                          ↓
  연결 코드 생성            메시지 중계               연결 코드 입력
  영상 전송                offer/answer              영상 수신
                          ICE candidate              녹화/분석
```

## 🚀 프로덕션 배포 시 고려사항

1. **HTTPS/WSS 사용**: 보안 연결 필수
2. **TURN 서버**: NAT 통과를 위해 필수
3. **인증**: 시그널링 서버에 인증 추가
4. **로드 밸런싱**: 다수 사용자 지원
5. **모니터링**: 연결 상태 모니터링
6. **에러 처리**: 재연결 로직 강화

## 📝 라이선스

이 프로젝트는 배구 경기 분석을 위한 전문 도구입니다.
