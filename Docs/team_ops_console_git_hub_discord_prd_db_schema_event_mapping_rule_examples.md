# TeamOps Console (GitHub + Discord)

6명 팀 세미프로젝트에서 **이슈 → PR → 리뷰 → 배포 → 공지** 흐름을 표준화하고, **룰(Policy)을 제품 안에서 관리**하며, 병목을 **지표로 가시화**하는 경량 Internal Product.

---

## 1. PRD (1-pager)

### 1.1 문제 정의
작은 팀(6명)은 툴은 갖고 있어도(깃헙/디스코드), 운영 지식이 사람 머리에 남아 아래 문제가 반복된다.

- 이슈가 잘못된 형태로 등록되어(재현/수용기준 누락) 다시 묻고 답하느라 시간 소모
- PR이 리뷰 대기/CI 실패 상태로 오래 방치되지만 팀 전체가 즉시 인지하지 못함
- 배포/데모 링크가 일관되게 공유되지 않아 “현재 정상 버전이 어디인지” 혼란
- 병목(리뷰 지연, CI 실패 반복, 특정 라벨 backlog 증가)이 감으로만 느껴지고 측정되지 않음

### 1.2 목표
- **Rule-as-Product**: 라벨/담당/우선순위/요구사항 검증 룰을 코드가 아니라 제품(UI/DB)에서 관리
- **Flow Visibility**: 이슈/PR/배포 상태를 단일 화면에서 추적
- **Actionable Notifications**: 디스코드 알림이 “단순 이벤트”가 아니라 “다음 행동”을 포함

### 1.3 비목표 (세미프로젝트 범위에서 제외)
- Jira/Linear 수준의 복잡한 워크플로우 엔진
- 조직/팀/레포 다중 테넌시(초기엔 1 repo 기준)
- 고급 권한/SSO/IAM

### 1.4 사용자
- **Contributor(개발자)**: 이슈/PR 작성, 리뷰 요청, 데모 링크 확인
- **Maintainer(리드/통합 담당)**: 우선순위/담당 배정, 병목 확인, 배포 공지

### 1.5 핵심 사용자 플로우
1) **이슈 생성(템플릿 기반)** → TeamOps가 필드 누락 검증 → 라벨/우선순위/담당 추천/할당 → 디스코드 요약 알림
2) **PR 생성/리뷰요청** → TeamOps가 PR↔Issue 연계/상태 추적 → 리뷰 대기 시간/CI 상태 반영 → 디스코드 상태 카드 알림
3) **PR 머지/배포 완료** → 릴리즈/데모 URL 수집 → 관련 이슈 자동 종료/상태 업데이트 → 디스코드 배포 공지
4) **대시보드**에서 병목(리뷰 지연/CI 실패/Backlog 급증) 확인

### 1.6 핵심 기능 (MVP)
#### F1. GitHub Webhook 수집 & 엔티티 모델링
- issue, pull_request, pull_request_review, workflow_run, release
- 수집 이벤트를 **Issue/PR/Release 엔티티 상태**로 반영

#### F2. Rule Engine (DB 기반)
- 조건(이벤트/라벨/작성자/파일경로/브랜치 등) → 액션(라벨/코멘트/할당/디스코드 알림)
- 룰 활성/비활성, 우선순위, 변경 이력 저장

#### F3. Discord Notifier
- 이벤트별 메시지 템플릿
- PR 상태 카드(리뷰 대기 시간, CI, 링크, 관련 이슈) → 상태 변경 시 메시지 **수정(Edit)**으로 노이즈 감소

#### F4. Flow Dashboard (1페이지)
- Review queue(리뷰 대기 PR)
- CI failing PR
- Hot issues(우선순위 높은 이슈)
- Metrics: 평균 리뷰 대기 시간, PR 리드타임, CI 실패율(최근 7일)

### 1.7 성공 지표 (세미프로젝트용)
- 리뷰 대기 평균 시간(hrs) ↓
- CI 실패율(실패 PR 수 / 전체 PR) ↓
- 템플릿 누락 보정률(누락 검출 후 보정 완료 비율) ↑
- 이슈→PR→머지 평균 리드타임 ↓

### 1.8 리스크 & 대응
- Webhook 이벤트 누락/재시도: 이벤트 저장 후 idempotency(중복 방지) 키 적용
- 룰 충돌: 룰 우선순위 + “dry-run” 모드(미적용/로그만)
- 디스코드 스팸: 디듀프(같은 PR 동일 상태 반복 알림 제한) + 쿨다운
- 무한 루프: 봇이 생성한 이벤트(`sender.type == 'Bot'`)는 룰 실행 제외

---

## 2. DB 스키마 (SQLite 초안)

> 목표: (1) 이벤트 원본을 보관하고 (2) 엔티티 상태를 materialize하며 (3) 룰/실행 이력을 남긴다.

### 2.1 tables

#### 2.1.1 repos
- `id` INTEGER PK
- `owner` TEXT NOT NULL
- `name` TEXT NOT NULL
- `github_repo_id` INTEGER UNIQUE NOT NULL
- `default_branch` TEXT DEFAULT 'main'
- `created_at` TEXT NOT NULL

#### 2.1.2 github_events (원본 이벤트 저장)
- `id` INTEGER PK
- `repo_id` INTEGER NOT NULL FK(repos.id)
- `delivery_id` TEXT UNIQUE NOT NULL  
  - GitHub 헤더 `X-GitHub-Delivery`
- `event_type` TEXT NOT NULL  
  - issue / pull_request / workflow_run / release / deployment_status
- `action` TEXT NULL  
  - opened, edited, synchronize, requested_review, closed, published 등
- `signature_ok` INTEGER NOT NULL DEFAULT 0
- `received_at` TEXT NOT NULL
- `payload_json` TEXT NOT NULL  
- `processed_at` TEXT NULL
- `process_status` TEXT NOT NULL DEFAULT 'NEW'  
  - NEW / OK / ERROR
- `process_error` TEXT NULL

#### 2.1.3 issues (현재 상태 스냅샷)
- `id` INTEGER PK
- `repo_id` INTEGER NOT NULL FK
- `github_issue_id` INTEGER UNIQUE NOT NULL
- `number` INTEGER NOT NULL
- `title` TEXT NOT NULL
- `state` TEXT NOT NULL  
  - OPEN / CLOSED
- `author_login` TEXT NOT NULL
- `assignees_json` TEXT NULL
- `labels_json` TEXT NULL
- `priority` TEXT NULL  
  - P0/P1/P2/P3
- `scope` TEXT NULL  
  - frontend/backend/infra/docs/unknown
- `missing_fields_json` TEXT NULL  
  - 템플릿 누락(재현, 수용기준 등)
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `closed_at` TEXT NULL

#### 2.1.4 pull_requests (현재 상태 스냅샷)
- `id` INTEGER PK
- `repo_id` INTEGER NOT NULL FK
- `github_pr_id` INTEGER UNIQUE NOT NULL
- `number` INTEGER NOT NULL
- `title` TEXT NOT NULL
- `state` TEXT NOT NULL  
  - OPEN / CLOSED / MERGED
- `author_login` TEXT NOT NULL
- `base_branch` TEXT NOT NULL
- `head_branch` TEXT NOT NULL
- `draft` INTEGER NOT NULL DEFAULT 0
- `labels_json` TEXT NULL
- `requested_reviewers_json` TEXT NULL
- `assignees_json` TEXT NULL
- `linked_issue_numbers_json` TEXT NULL  
  - "Fixes #12" 파싱 결과
- `ci_status` TEXT NULL  
  - SUCCESS / FAILURE / RUNNING / UNKNOWN
- `review_status` TEXT NULL  
  - NEEDS_REVIEW / APPROVED / CHANGES_REQUESTED / UNKNOWN
- `first_review_requested_at` TEXT NULL
- `merged_at` TEXT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

#### 2.1.5 releases
- `id` INTEGER PK
- `repo_id` INTEGER NOT NULL FK
- `github_release_id` INTEGER UNIQUE NOT NULL
- `tag_name` TEXT NOT NULL
- `name` TEXT NULL
- `target_commitish` TEXT NULL
- `html_url` TEXT NOT NULL
- `published_at` TEXT NULL
- `created_at` TEXT NOT NULL

#### 2.1.6 deployments (선택: 데모 URL/환경 관리)
- `id` INTEGER PK
- `repo_id` INTEGER NOT NULL
- `environment` TEXT NOT NULL  
  - preview/staging/prod
- `source` TEXT NOT NULL  
  - vercel/render/custom
- `status` TEXT NOT NULL  
  - SUCCESS/FAILURE/RUNNING
- `url` TEXT NULL
- `commit_sha` TEXT NULL
- `related_pr_number` INTEGER NULL
- `occurred_at` TEXT NOT NULL

#### 2.1.7 rules
- `id` INTEGER PK
- `repo_id` INTEGER NOT NULL
- `name` TEXT NOT NULL
- `enabled` INTEGER NOT NULL DEFAULT 1
- `priority` INTEGER NOT NULL DEFAULT 100  
  - 낮을수록 먼저 실행
- `event_type` TEXT NOT NULL
- `event_action` TEXT NULL  
  - NULL이면 모든 action
- `condition_json` TEXT NOT NULL
- `actions_json` TEXT NOT NULL
- `cooldown_seconds` INTEGER NOT NULL DEFAULT 0
- `created_by` TEXT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

#### 2.1.8 rule_runs (룰 실행 이력)
- `id` INTEGER PK
- `repo_id` INTEGER NOT NULL
- `rule_id` INTEGER NOT NULL
- `delivery_id` TEXT NOT NULL
- `entity_type` TEXT NULL  
  - ISSUE/PR/RELEASE
- `entity_number` INTEGER NULL
- `result` TEXT NOT NULL  
  - APPLIED / SKIPPED / ERROR
- `details_json` TEXT NULL
- `ran_at` TEXT NOT NULL

#### 2.1.9 discord_messages (디듀프/쿨다운용)
- `id` INTEGER PK
- `repo_id` INTEGER NOT NULL
- `channel_key` TEXT NOT NULL  
  - 예: 'dev' 'announcements'
- `dedupe_key` TEXT NOT NULL
- `message_id` TEXT NULL
- `content_hash` TEXT NULL
- `sent_at` TEXT NOT NULL
- UNIQUE(`repo_id`, `dedupe_key`)

#### 2.1.10 users (멤버 매핑)
- `id` INTEGER PK
- `github_login` TEXT UNIQUE NOT NULL
- `discord_user_id` TEXT NULL  
  - 멘션(@User)을 위해 필요
- `role` TEXT DEFAULT 'MEMBER'  
  - MAINTAINER / MEMBER
- `created_at` TEXT NOT NULL

### 2.2 인덱스 추천
- github_events(repo_id, received_at)
- issues(repo_id, state, priority)
- pull_requests(repo_id, state, review_status, ci_status)
- rule_runs(repo_id, rule_id, ran_at)

---

## 3. GitHub 이벤트 → 엔티티 매핑표

> 원칙: **원본 이벤트(github_events)**는 그대로 저장하고, 아래 규칙으로 **materialized state(issues/pull_requests/...)**를 업데이트한다.

### 3.1 Issue 이벤트 매핑
| GitHub event | action | 업데이트 대상 | 상태/필드 업데이트 | 비고 |
|---|---|---|---|---|
| issues | opened | issues | INSERT/UPSERT, state=OPEN, title/author/labels/assignees, created_at | 템플릿 누락 검사 트리거 |
| issues | edited | issues | title/body 기반 missing_fields 재검사, labels/assignees 반영 | body는 payload에서 파싱 |
| issues | labeled/unlabeled | issues | labels_json 업데이트 | scope/priority 추론 가능 |
| issues | assigned/unassigned | issues | assignees_json 업데이트 |  |
| issues | closed/reopened | issues | state=CLOSED/OPEN, closed_at 세팅/해제 |  |

### 3.2 Pull Request 이벤트 매핑
| GitHub event | action | 업데이트 대상 | 상태/필드 업데이트 | 비고 |
|---|---|---|---|---|
| pull_request | opened | pull_requests | UPSERT, state=OPEN, draft/base/head, labels/reviewers, created_at | linked_issue 파싱 |
| pull_request | ready_for_review | pull_requests | draft=0 |  |
| pull_request | synchronize | pull_requests | updated_at 갱신, linked_issue 재파싱(옵션) | 커밋 추가 |
| pull_request | requested_review | pull_requests | requested_reviewers 업데이트, first_review_requested_at 세팅(없으면) | 리뷰 대기 지표 시작 |
| pull_request_review | submitted | pull_requests | review_status 업데이트(approved/changes_requested) | 별도 webhook 필수 |
| pull_request | closed | pull_requests | merged 여부에 따라 state=MERGED/CLOSED, merged_at | 머지 시 배포/공지 트리거 |

### 3.3 CI/워크플로우 매핑
| GitHub event | action | 업데이트 대상 | 상태/필드 업데이트 | 비고 |
|---|---|---|---|---|
| workflow_run | completed | pull_requests | ci_status=success/failure, updated_at | PR 연계는 payload의 head_sha→PR lookup(단순 캐시) |

### 3.4 Release/Deployment 매핑
| GitHub event | action | 업데이트 대상 | 상태/필드 업데이트 | 비고 |
|---|---|---|---|---|
| release | published | releases | UPSERT tag/name/url/published_at | 디스코드 배포 공지 |
| deployment_status | created | deployments | environment/status/url/sha | 가능하면 적용, 없으면 외부 배포 webhook로 대체 |

---

## 4. Rule DSL(표현 방식) & 룰 예시

### 4.1 Rule DSL (condition_json / actions_json)

#### condition_json 예시 스키마
```json
{
  "match": {
    "labels_any": ["type:bug"],
    "labels_all": [],
    "author_in": [],
    "scope_in": ["backend"],
    "title_regex": "^\\[P[0-3]\\]",
    "missing_fields_any": ["repro_steps"],
    "pr": {
      "draft": false,
      "base_branch_in": ["dev"],
      "ci_status_in": ["FAILURE"],
      "review_status_in": ["NEEDS_REVIEW"],
      "age_minutes_gte": 240
    }
  }
}
```

#### actions_json 예시 스키마
```json
{
  "actions": [
    {"type": "add_labels", "labels": ["prio:P1", "scope:backend"]},
    {"type": "set_priority", "priority": "P1"},
    {"type": "assign", "assignees": ["alice"]},
    {"type": "comment", "body": "재현 방법이 누락되었습니다. 템플릿의 'Repro Steps'를 채워주세요."},
    {"type": "discord_notify", "channel": "dev", "template": "issue_opened", "dedupe": "ISSUE:{number}:OPENED"}
  ]
}
```

> 주의: 세미프로젝트 MVP에서는 모든 필드를 구현할 필요 없음. **labels/assignees/discord_notify/missing_fields** 정도만으로도 제품 느낌이 난다.

---

### 4.2 룰 예시 12개 (바로 제품 가치가 나오는 것들)

#### R1. 이슈 템플릿 누락 보정(자동 코멘트)
- 이벤트: issues opened/edited
- 조건: missing_fields_any contains 'acceptance_criteria' OR 'repro_steps'
- 액션: comment + 라벨 `needs:info`

조건:
```json
{"match":{"missing_fields_any":["acceptance_criteria","repro_steps"]}}
```
액션:
```json
{"actions":[
  {"type":"add_labels","labels":["needs:info"]},
  {"type":"comment","body":"필수 정보가 누락되었습니다: {missing_fields}. 템플릿을 채워주세요."},
  {"type":"discord_notify","channel":"dev","template":"issue_needs_info","dedupe":"ISSUE:{number}:NEEDS_INFO"}
]}
```

#### R2. Feature 기본 분류(라벨 자동)
- 이벤트: issues opened
- 조건: 템플릿에서 type=feature (또는 title prefix)
- 액션: `type:feature`, `prio:P2`

#### R3. Bug는 기본 P1 + 재현요구
- 이벤트: issues opened
- 조건: labels_any contains `type:bug`
- 액션: `prio:P1` + 재현 누락 시 needs:info

#### R4. scope 체크박스에 따라 담당자 추천/할당
- 이벤트: issues opened
- 조건: scope_in contains 'frontend'
- 액션: assign FE 담당 1명(라운드로빈은 MVP에서 고정 2명 중 1명)

#### R5. 이슈에 P0 붙으면 공지 채널로
- 이벤트: issues labeled
- 조건: labels_any contains `prio:P0`
- 액션: discord_notify to announcements

#### R6. PR opened 시 관련 이슈 연결 파싱 안내
- 이벤트: pull_request opened
- 조건: linked_issue_numbers_json is empty
- 액션: comment("본문에 Fixes #123 형식으로 이슈를 연결하세요")

#### R7. PR 리뷰 요청 시 ‘리뷰 대기 카드’ 발행
- 이벤트: pull_request requested_review
- 조건: pr.review_status_in includes NEEDS_REVIEW
- 액션: discord_notify(dev)

#### R8. 리뷰 대기 4시간 초과 PR 리마인드(스팸 방지 쿨다운)
- 이벤트: pull_request (주기 스케줄러 이벤트로도 가능)
- 조건: review_status=NEEDS_REVIEW AND age_minutes_gte=240
- 액션: discord_notify + cooldown 6h

#### R9. CI 실패 PR은 dev 채널에 원인/다음 액션 포함
- 이벤트: workflow_run completed
- 조건: ci_status=FAILURE
- 액션: discord_notify("CI 실패: 로그 링크, 최근 변경 파일")

#### R10. PR 머지되면 배포 링크/릴리즈 노트 안내
- 이벤트: pull_request closed(merged)
- 조건: state=MERGED
- 액션: discord_notify(announcements, template=deploy_notice)

#### R11. Hotfix 브랜치면 우선순위 상향
- 이벤트: pull_request opened
- 조건: head_branch matches `hotfix/.*`
- 액션: add label `prio:P0`, notify announcements

#### R12. PR에 변경 파일이 infra/면 infra 리뷰어 자동 요청
- 이벤트: pull_request opened/synchronize
- 조건: (파일경로 기반) changed_files_any startswith `infra/` or `.github/`
- 액션: request_reviewers(['infra_owner']) + add label `scope:infra`

---

## 5. 디스코드 메시지 템플릿 (MVP용 4개)

### T1 issue_needs_info
- 제목: `🧩 Issue #{number} 정보 누락`
- 본문: `{title}` / 작성자 `{author}`
- 누락: `{missing_fields}`
- 링크: `{url}`
- 액션: `템플릿 보완 후 코멘트로 "Fixed" 남겨주세요`

### T2 issue_opened
- 제목: `🆕 Issue #{number} 생성`
- 요약: `{title}`
- 라벨/우선순위: `{labels} / {priority}`
- 담당: `{assignees}`

### T3 pr_review_requested
- 제목: `👀 PR #{number} 리뷰 요청`
- 상태: `CI: {ci_status} | Review: NEEDS_REVIEW | Draft:{draft}`
- 연결 이슈: `{linked_issues}`
- 링크: `{url}`

### T4 deploy_notice
- 제목: `🚀 Deployed / Merged: PR #{number}`
- 변경 요약: `{summary}`
- Compare: `{compare_url}`
- 데모: `{deploy_url}`
- 관련 이슈: `{linked_issues}`

---

## 6. 구현 메모 (세미프로젝트 현실 버전)

### 6.1 최소 구성요소
- Webhook receiver (FastAPI/Express)
- SQLite + 간단 ORM/쿼리
- Rule evaluator(조건 매칭) + action executor(GitHub API / Discord Webhook)
- Dashboard(Next.js/React 단일 페이지)

### 6.2 Idempotency(중복 방지)
- github_events.delivery_id UNIQUE
- discord_messages.dedupe_key UNIQUE

### 6.3 보안(세미프로젝트 최소선)
- GitHub webhook signature 검증(secret)
- GitHub token은 최소 권한(repos:status, issues, pull_requests)
- Discord webhook URL은 서버 env로만

---

## 7. MVP 체크리스트
- [ ] Webhook 수신 → github_events 저장
- [ ] issues/pull_requests 스냅샷 UPSERT
- [ ] missing_fields 검사(간단: 템플릿 섹션 헤더 존재 여부)
- [ ] rules 테이블 기반 룰 실행 + rule_runs 저장
- [ ] Discord 알림 4종 발송 + dedupe
- [ ] Dashboard: 리뷰 대기 PR / CI 실패 PR / P0 이슈 / 7일 지표

---

## 8. 확장 아이디어 (후속)
- 룰 관리 UI(토글/우선순위/담당자 매핑)
- 라운드로빈 할당(최근 7일 부담량 기반)
- PR 변경 파일 분석(경로→scope/리뷰어 자동)
- 배포 플랫폼 연동(Vercel/Render webhook)
- Postmortem 자동 생성(머지/알림/지표 타임라인)

