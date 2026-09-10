# stealth-dashboard (untitle.io)

## 배포 규칙 (최우선)
- 절대 자동으로 배포(commit+push)하지 않는다.
- 수정 후에는 반드시 로컬(serve.py, port 8123)에서 테스트하고, 사용자에게 결과 확인을 요청한다.
- 사용자가 명시적으로 "배포해줘"라고 말할 때만 commit + push 한다.

## 테스트
- 모든 수정 후 `cd tests && npm test` 전원 통과가 최소 요건이다.
